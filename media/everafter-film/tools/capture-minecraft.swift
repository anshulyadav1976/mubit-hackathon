// Build: xcrun swiftc -parse-as-library -O -framework ScreenCaptureKit -framework AppKit -framework AVFoundation media/everafter-film/tools/capture-minecraft.swift -o .tooling/capture-minecraft
// Run from an already authorized terminal: .tooling/capture-minecraft PID /absolute/new.mp4 SECONDS [--trim-top POINTS]
import AppKit
import AVFoundation
import ScreenCaptureKit

struct CaptureError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
func require(_ condition: Bool, _ message: String) throws {
    if !condition { throw CaptureError(message: message) }
}
struct Options {
    let pid: pid_t, output: URL, seconds: Double, trim: Double
    init(_ args: [String]) throws {
        try require(args.count == 3 || args.count == 5, "Usage: capture-minecraft PID /absolute/new.mp4 SECONDS [--trim-top POINTS]")
        guard let pid = Int32(args[0]), pid > 0, let seconds = Double(args[2]), seconds.isFinite,
              (1...600).contains(seconds) else { throw CaptureError(message: "PID must be positive; duration must be 1…600 seconds") }
        let trim = args.count == 5 ? Double(args[4]) : 0
        try require(args.count == 3 || args[3] == "--trim-top", "Only --trim-top POINTS is supported")
        try require(trim != nil && trim!.isFinite && (0...100).contains(trim!), "Top trim must be 0…100 points")
        try require(args[1].hasPrefix("/") && URL(fileURLWithPath: args[1]).pathExtension.lowercased() == "mp4", "Output must be an absolute .mp4 path")
        self.pid = pid; output = URL(fileURLWithPath: args[1]).standardizedFileURL; self.seconds = seconds; self.trim = trim!
    }
}
func crop(_ window: CGRect, display: CGRect, trim: Double) throws -> CGRect {
    try require(window.width >= 320 && window.height - trim >= 180 && display.contains(window), "Minecraft must be fully inside one display, at least 320×180 content points")
    return CGRect(x: window.minX - display.minX, y: window.minY - display.minY + trim, width: window.width, height: window.height - trim)
}
func fit(_ size: CGSize) -> CGRect {
    let scale = min(1920 / size.width, 1080 / size.height)
    let w = size.width * scale, h = size.height * scale
    return CGRect(x: (1920 - w) / 2, y: (1080 - h) / 2, width: w, height: h)
}

@MainActor final class Recorder: NSObject, SCStreamDelegate, SCRecordingOutputDelegate {
    let options: Options
    let temporary: URL
    var stream: SCStream?, output: SCRecordingOutput?, observer: NSObjectProtocol?, timer: Timer?
    var windowID: CGWindowID = 0, frame = CGRect.zero, started: Date?, stopping = false, finished = false
    var exitCode: Int32 = 0
    let black = CGColor(gray: 0, alpha: 1)
    init(_ options: Options) {
        self.options = options
        temporary = options.output.deletingLastPathComponent().appendingPathComponent(".everafter-\(UUID().uuidString).partial.mp4")
    }
    func prepare() async throws {
        try require(!FileManager.default.fileExists(atPath: options.output.path), "Refusing to overwrite existing output")
        let parent = options.output.deletingLastPathComponent().path
        var directory: ObjCBool = false
        try require(FileManager.default.fileExists(atPath: parent, isDirectory: &directory) && directory.boolValue, "Output directory must already exist")
        try require(CGPreflightScreenCaptureAccess(), "Screen Recording permission is required for this terminal/helper; enable it in macOS Settings, then rerun")
        try require(NSRunningApplication(processIdentifier: options.pid)?.executableURL?.lastPathComponent == "java", "Target PID must be the observed Java Minecraft process")
        try require(NSWorkspace.shared.frontmostApplication?.processIdentifier == options.pid, "Minecraft must already be frontmost; this helper never activates apps")
        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
        let windows = content.windows.filter { $0.owningApplication?.processID == options.pid && ($0.title ?? "").hasPrefix("Minecraft") && $0.windowLayer == 0 }
        try require(windows.count == 1, "Expected exactly one visible Minecraft Java window for the supplied PID")
        let window = windows[0]
        guard let display = content.displays.first(where: { $0.frame.contains(window.frame) }) else { throw CaptureError(message: "Minecraft must fit entirely inside one display") }
        windowID = window.windowID; frame = window.frame
        let source = try crop(frame, display: display.frame, trim: options.trim)
        // Full display audio includes afplay; sourceRect limits pixels to the game's observed frame.
        let filter = SCContentFilter(display: display, excludingWindows: []); filter.includeMenuBar = false
        let config = SCStreamConfiguration()
        config.width = 1920; config.height = 1080; config.minimumFrameInterval = CMTime(value: 1, timescale: 30)
        config.sourceRect = source; config.destinationRect = fit(source.size); config.preservesAspectRatio = true
        config.capturesAudio = true; config.sampleRate = 48000; config.channelCount = 2; config.captureMicrophone = false
        config.showsCursor = true; config.queueDepth = 3; config.backgroundColor = black
        let recording = SCRecordingOutputConfiguration(); recording.outputURL = temporary
        recording.videoCodecType = .h264; recording.outputFileType = .mp4
        output = SCRecordingOutput(configuration: recording, delegate: self)
        stream = SCStream(filter: filter, configuration: config, delegate: self)
        try stream!.addRecordingOutput(output!)
        observer = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.guardWindow() }
        }
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] _ in Task { @MainActor in self?.guardWindow() } }
        guardWindow(); if stopping { return }
        try await stream!.startCapture()
    }
    func guardWindow() {
        guard !stopping && !finished else { return }
        let rows = CGWindowListCopyWindowInfo([.optionIncludingWindow, .excludeDesktopElements], windowID) as? [[String: Any]] ?? []
        let row = rows.first { ($0[kCGWindowNumber as String] as? UInt32) == windowID }
        let bounds = row?[kCGWindowBounds as String] as? [String: Double]
        let current = bounds.flatMap { values -> CGRect? in
            guard let x = values["X"], let y = values["Y"], let w = values["Width"], let h = values["Height"] else { return nil }
            return CGRect(x: x, y: y, width: w, height: h)
        }
        if NSWorkspace.shared.frontmostApplication?.processIdentifier != options.pid || current != frame
            || (row?[kCGWindowIsOnscreen as String] as? Bool) != true
            || (row?[kCGWindowOwnerPID as String] as? Int32) != options.pid {
            stop("Minecraft lost focus, moved, resized, or disappeared")
        }
    }
    func stop(_ reason: String) {
        guard !stopping && !finished else { return }; stopping = true; timer?.invalidate()
        fputs("CAPTURE_STOPPING \(reason)\n", stderr)
        guard let stream else { fail("Capture stopped before stream creation"); return }
        Task {
            do { try await stream.stopCapture() } catch { fail("Cannot stop recording: \(error.localizedDescription)") }
            try? await Task.sleep(for: .seconds(20))
            if !finished { fail("Recording did not finish flushing within 20 seconds") }
        }
    }
    func fail(_ message: String) {
        guard !finished else { return }; finished = true; exitCode = 1; timer?.invalidate()
        fputs("CAPTURE_ERROR \(message)\n", stderr)
        if let stream { Task { try? await stream.stopCapture() } }
    }
    nonisolated func recordingOutputDidStartRecording(_ recordingOutput: SCRecordingOutput) {
        Task { @MainActor in
            guard !self.finished else { return }; self.started = Date(); print("CAPTURE_STARTED"); fflush(stdout)
            try? await Task.sleep(for: .seconds(self.options.seconds)); self.stop("Requested duration reached")
        }
    }
    nonisolated func recordingOutputDidFinishRecording(_ recordingOutput: SCRecordingOutput) {
        Task { @MainActor in
            guard !self.finished else { return }
            do {
                try require(recordingOutput.recordedDuration.seconds > 0 && recordingOutput.recordedFileSize > 0, "Recording finished without media")
                try FileManager.default.moveItem(at: self.temporary, to: self.options.output)
                self.finished = true; self.timer?.invalidate()
                print(String(format: "CAPTURE_SAVED duration=%.3f", recordingOutput.recordedDuration.seconds)); fflush(stdout)
            } catch { self.fail("Cannot save recording without overwriting: \(error.localizedDescription)") }
        }
    }
    nonisolated func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: Error) { Task { @MainActor in self.fail(error.localizedDescription) } }
    nonisolated func stream(_ stream: SCStream, didStopWithError error: Error) { Task { @MainActor in self.fail(error.localizedDescription) } }
}

@main struct CaptureMinecraft {
    @MainActor static func main() async {
        unsetenv("MUBIT_API_KEY"); unsetenv("OPENROUTER_API_KEY")
        do {
            let args = Array(CommandLine.arguments.dropFirst())
            if args == ["--self-test"] {
                for bad in [["0", "/tmp/a.mp4", "8"], ["1", "/tmp/a.mp4", "0"], ["1", "/tmp/a.mp4", "601"], ["1", "/tmp/a.mp4", "nan"], ["1", "a.mp4", "8"], ["1", "/tmp/a.mp4", "8", "--trim-top", "101"]] {
                    do { _ = try Options(bad); fatalError("Accepted invalid arguments") } catch { }
                }
                _ = try Options(["1", "/tmp/a.mp4", "600", "--trim-top", "28"])
                let cropped = try crop(CGRect(x: 110, y: 70, width: 800, height: 628), display: CGRect(x: 100, y: 50, width: 1200, height: 900), trim: 28)
                try require(cropped == CGRect(x: 10, y: 48, width: 800, height: 600), "Crop coordinates failed")
                try require(fit(CGSize(width: 800, height: 600)) == CGRect(x: 240, y: 0, width: 1440, height: 1080), "Aspect preservation failed")
                do { _ = try crop(CGRect(x: -1, y: 0, width: 800, height: 600), display: CGRect(x: 0, y: 0, width: 1200, height: 900), trim: 0); fatalError("Accepted off-display window") } catch { }
                print("SELF_TEST_OK"); return
            }
            let recorder = Recorder(try Options(args))
            Task { do { try await recorder.prepare() } catch { recorder.fail(error.localizedDescription) } }
            Task { try? await Task.sleep(for: .seconds(20)); if recorder.started == nil && !recorder.finished { recorder.fail("Recording did not start within 20 seconds") } }
            while !recorder.finished { try await Task.sleep(for: .milliseconds(50)) }
            if let observer = recorder.observer { NSWorkspace.shared.notificationCenter.removeObserver(observer) }
            exit(recorder.exitCode)
        } catch { fputs("CAPTURE_ERROR \(error.localizedDescription)\n", stderr); exit(1) }
    }
}
