module.exports = (err, req, res, _next) => {
  console.error(err);
  const map = {
    LIMIT_FILE_SIZE: [400, 'File too large'],
    UNSUPPORTED_TYPE: [400, 'Unsupported file type']
  };
  const [status, message] = map[err.code] || map[err.message] || [500, 'Something went wrong'];
  res.status(status).json({ success: false, message, errorCode: err.code || err.message || 'SERVER_ERROR' });
};
