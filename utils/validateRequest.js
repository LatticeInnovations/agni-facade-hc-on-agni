function validateInput(userInput, dataSchema) {
  return dataSchema.validate(userInput);
}


const validateRequest = (userInput, dataSchema, res) => {
    console.log("userInput:", userInput, dataSchema)
    const result = validateInput(userInput, dataSchema);
    if (result.error) {
        console.error(result.error.details);
        res.status(422).json({
            code: "ERR",
            statusCode: 422,
            response: { data: result.error.details[0] },
            message: "Invalid input"
        });
        return null
    }

    return result.value;
};

// You can add more shared utility functions here as needed
const formatDate = (date) => {
    return new Date(date).toISOString().split('T')[0];
};

const sendErrorResponse = (res, error, statusCode = 500, message = "Something went wrong") => {
    console.error(error);
    res.status(statusCode).json({
        code: "ERR",
        statusCode,
        response: { error },
        message,
    });
};

module.exports = {
    validateRequest,
    formatDate,
    sendErrorResponse
};