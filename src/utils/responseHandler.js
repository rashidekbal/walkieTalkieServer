function sendSuccess(res, data = {}, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function sendError(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors })
  });
}

module.exports = {
  sendSuccess,
  sendError
};
