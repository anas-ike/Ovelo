import { asyncHandler } from '../utils/async-handler.js';
import { requireCurrentPolicyConsent } from '../auth/policy-consent.service.js';

// Runs before multer accepts the multipart body, so a missing current
// acknowledgement cannot reach file validation, scanning or storage.
export const requireUploadConsent = asyncHandler(async (req, _res, next) => {
  await requireCurrentPolicyConsent(
    req.auth!.userId,
    { uploadProcessingVersion: req.header('x-upload-processing-version') },
    ['UPLOAD_PROCESSING'],
  );
  next();
});
