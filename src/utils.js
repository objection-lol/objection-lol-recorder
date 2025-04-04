/*
Since in the recording the audio cuts off at the end, we append this duration to the recording then
trim it out. This is because ffmpeg audio buffering causes the audio to cut off at the end of the
recording. This is a temporary fix until a better solution is found.
*/
export const audioTrimDuration = 0.5;

/**
 * Gets the URL for a recording on the Objection website
 * @param {string} objectionId - The ID of the recording
 * @returns {string} The URL of the recording
 */
export const getRecordingUrl = (objectionId) => {
  const baseUrl = 'https://objection.lol';

  return `${baseUrl}/record/${objectionId}`;
};
