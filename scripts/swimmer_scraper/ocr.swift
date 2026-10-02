import Foundation
import PDFKit
import Vision
import AppKit

// Local OCR for scanned result books. Output retains page coordinates for review.
let args = CommandLine.arguments
guard args.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else { exit(1) }
let start = args.count > 3 ? Int(args[3])! - 1 : 0
let end = args.count > 4 ? min(Int(args[4])!, doc.pageCount) : doc.pageCount
for i in start..<end {
    autoreleasepool {
        let page = doc.page(at: i)!
        let bounds = page.bounds(for: .mediaBox)
        let image = page.thumbnail(of: NSSize(width: bounds.width * 2, height: bounds.height * 2), for: .mediaBox)
        var rect = CGRect(origin: .zero, size: image.size)
        guard let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { return }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesCPUOnly = true
        request.usesLanguageCorrection = false
        try! VNImageRequestHandler(cgImage: cg).perform([request])
        let rows: [[String: Any]] = (request.results ?? []).map { r in
            ["text": r.topCandidates(1).first?.string ?? "", "confidence": r.topCandidates(1).first?.confidence ?? 0,
             "x": r.boundingBox.minX, "y": 1-r.boundingBox.maxY, "width": r.boundingBox.width, "height": r.boundingBox.height]
        }
        let data = try! JSONSerialization.data(withJSONObject: rows, options: [.sortedKeys])
        try! data.write(to: URL(fileURLWithPath: args[2] + ".page-\(i+1).ocr.json"))
        print("OCR page \(i+1)/\(doc.pageCount)")
        fflush(stdout)
    }
}
