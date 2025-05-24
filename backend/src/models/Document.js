import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalFilename: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  pageCount: {
    type: Number,
    default: 0
  },
  chunkCount: {
    type: Number,
    default: 0
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  processingStages: [{
    id: {
      type: String,
      enum: ['uploading', 'extracting', 'cleaning', 'chunking', 'embedding', 'storing'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Statics
DocumentSchema.statics.updateProcessingStatus = async function(documentId, status, progress = null, stageId = null, stageStatus = null) {
  const updateData = { processingStatus: status };
  
  if (progress !== null) {
    updateData.processingProgress = progress;
  }
  
  if (stageId && stageStatus) {
    // If stage exists, update it
    const existingStage = await this.findOne(
      { _id: documentId, 'processingStages.id': stageId },
      { 'processingStages.$': 1 }
    );
    
    if (existingStage && existingStage.processingStages.length > 0) {
      await this.updateOne(
        { _id: documentId, 'processingStages.id': stageId },
        { 
          $set: { 
            'processingStages.$.status': stageStatus,
            'processingStages.$.timestamp': new Date()
          }
        }
      );
    } else {
      // If stage doesn't exist, add it
      await this.updateOne(
        { _id: documentId },
        { 
          $push: { 
            processingStages: {
              id: stageId,
              status: stageStatus,
              timestamp: new Date()
            }
          }
        }
      );
    }
  }
  
  return this.findByIdAndUpdate(documentId, updateData, { new: true });
};

const Document = mongoose.model('Document', DocumentSchema);

export default Document;