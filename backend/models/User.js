import mongoose from 'mongoose';

const { Schema } = mongoose;

const PreferencesSchema = new Schema(
  {
    categories: { type: [String], default: [] },
    priceRange: { type: String, default: 'any' },
    // conservative | balanced | aggressive
    riskLevel: { type: String, default: 'balanced' },
  },
  { _id: false },
);

const NotificationSettingsSchema = new Schema(
  {
    taskCompleted: { type: Boolean, default: true },
    taskFailed: { type: Boolean, default: true },
    agentAlert: { type: Boolean, default: true },
    recommendations: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * A user is identified purely by wallet address (lowercased for stable lookup).
 * No passwords, emails, or custodial secrets — auth is wallet-signature based.
 */
const UserSchema = new Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // References Agent.agentId (public id), not Mongo _id.
    savedAgents: { type: [String], default: [] },
    hiredAgents: { type: [String], default: [] },
    preferences: { type: PreferencesSchema, default: () => ({}) },
    notificationSettings: { type: NotificationSettingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', UserSchema);
