import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import PDFProcessingService from '../services/pdfProcessingService.js';

// Upload a PDF
export const uploadPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }

    // Generate document ID
    const documentId = `doc_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    // Create document record
    const document = {
      documentId,
      filename: req.file.filename,
      originalFilename: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      processingStatus: 'pending',
      processingProgress: 0,
      processingStages: [
        { id: 'uploading', status: 'completed' },
        { id: 'extracting', status: 'pending' },
        { id: 'cleaning', status: 'pending' },
        { id: 'chunking', status: 'pending' },
        { id: 'embedding', status: 'pending' },
        { id: 'storing', status: 'pending' }
      ]
    };
    
    // In a real implementation, you would save the document to the database
    // const savedDocument = await Document.create(document);
    
    // Start processing the document asynchronously
    processPdf(documentId, req.file.path);
    
    res.status(200).json({
      success: true,
      documentId,
      filename: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      message: 'PDF uploaded successfully and is being processed'
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Failed to upload PDF'
    });
  }
};

// Get PDF processing status
export const getProcessingStatus = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Get processing status from the service
    const status = await PDFProcessingService.getProcessingStatus(documentId);
    
    res.status(200).json(status);
  } catch (error) {
    console.error('Error getting processing status:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Failed to get processing status'
    });
  }
};

// Get document info
export const getDocumentInfo = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // In a real implementation, you would fetch document info from your database
    // const document = await Document.findOne({ documentId });
    
    // For demo, we'll return a mock response
    const documentInfo = {
      documentId,
      filename: 'processed-lecture.pdf',
      originalFilename: 'sample-lecture.pdf',
      pageCount: 15,
      chunkCount: 45,
      createdAt: new Date().toISOString(),
      status: 'completed',
      processing: {
        usedLLMCleaning: false,
        validatedChunks: false,
        chunkSize: 500
      }
    };
    
    res.status(200).json(documentInfo);
  } catch (error) {
    console.error('Error getting document info:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Failed to get document info'
    });
  }
};

// Extract text from PDF without full processing
export const extractTextOnly = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }

    console.log('Extracting text from PDF...');
    const extractResult = await PDFProcessingService.extractTextFromPdf(req.file.path);
    
    if (!extractResult.extracted_successfully) {
      return res.status(500).json({
        error: true,
        message: extractResult.error || 'Text extraction failed'
      });
    }

    res.status(200).json({
      success: true,
      text: extractResult.text,
      pageCount: extractResult.pageCount,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('Error extracting text:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Failed to extract text'
    });
  }
};

// Process PDF document (runs asynchronously)
async function processPdf(documentId, filePath) {
  try {
    console.log(`Processing PDF document: ${documentId}`);
    
    // Update processing status (in real implementation, update database)
    console.log('Starting PDF processing pipeline...');
    
    // Use the enhanced PDF processing service
    const result = await PDFProcessingService.processPDFComplete(filePath, documentId);
    
    if (result.success) {
      console.log(`PDF processing completed successfully for ${documentId}`);
      console.log(`Processed ${result.processing.chunkCount} chunks from ${result.processing.pageCount} pages`);
      
      // In a real implementation, update the document status in the database
      // await Document.findByIdAndUpdate(documentId, { 
      //   pageCount: result.processing.pageCount,
      //   chunkCount: result.processing.chunkCount,
      //   processingStatus: 'completed',
      //   processingProgress: 100,
      //   completedAt: new Date()
      // });
    } else {
      console.error(`PDF processing failed for ${documentId}:`, result.error);
      
      // In a real implementation, update the document status with error
      // await Document.findByIdAndUpdate(documentId, { 
      //   processingStatus: 'failed',
      //   processingError: result.error,
      //   failedAt: new Date()
      // });
    }
  } catch (error) {
    console.error(`Error processing PDF ${documentId}:`, error);
    
    // In a real implementation, update the document status with error
    // await Document.findByIdAndUpdate(documentId, { 
    //   processingStatus: 'failed',
    //   processingError: error.message,
    //   failedAt: new Date()
    // });
  }
}

export default {
  uploadPdf,
  getProcessingStatus,
  getDocumentInfo,
  extractTextOnly
};