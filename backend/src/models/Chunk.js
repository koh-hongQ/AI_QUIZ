import mongoose from 'mongoose';

const ChunkSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  index: {
    type: Number,
    required: true
  },
  pageNumber: {
    type: Number,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  // Vector storage is handled by the vector database (e.g., Qdrant)
  // But we keep a reference to the vector ID
  vectorId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for faster queries
ChunkSchema.index({ documentId: 1, index: 1 });
ChunkSchema.index({ documentId: 1, pageNumber: 1 });

const Chunk = mongoose.model('Chunk', ChunkSchema);

export default Chunk;