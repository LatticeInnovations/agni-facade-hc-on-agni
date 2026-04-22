module.exports = (app) => {
  console.log("check V1")
  app.use("/api/v1", require("./v1"));
}