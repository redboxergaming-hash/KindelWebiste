const { success } = require("./_lib/response");

exports.handler = async () => {
  return success(
    {
      service: "kindle-smart-dashboard",
      status: "up"
    },
    {
      source: "mock"
    }
  );
};
