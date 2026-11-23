import mongoose from "mongoose";
import crypto from "node:crypto";

const userSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => crypto.randomUUID(),
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    usernameNormalized: {
      type: String,
      required: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

userSchema.pre("save", function (next) {
  if (!this.uuid) {
    this.uuid = crypto.randomUUID();
  }
  next();
});

export default mongoose.model("User", userSchema);
