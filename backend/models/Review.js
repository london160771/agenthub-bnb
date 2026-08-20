import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Reviews are gated on a real execution (Tier 2): a review must reference the
 * executionId it came from, so the UI can show a "verified execution" badge and
 * we never accumulate drive-by ratings.
 */
const ReviewSchema = new Schema(
  {
    agentId: { type: String, required: true, index: true },
    userAddress: { type: String, required: true, lowercase: true },
    executionId: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true },
);

// One review per execution.
ReviewSchema.index({ executionId: 1 }, { unique: true });
ReviewSchema.index({ agentId: 1, createdAt: -1 });

export const Review = mongoose.model('Review', ReviewSchema);
