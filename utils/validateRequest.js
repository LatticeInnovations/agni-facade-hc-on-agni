
const validateRequest = (req, res, validationFn) => {
    const result = validationFn(req.body);

    if (result.error) {
        console.error(result.error.details);
        res.status(422).json({
            code: "ERR",
            statusCode: 422,
            response: { data: result.error.details[0] },
            message: "Invalid input"
        });
        throw result.error; // Or return Promise.reject() if you prefer async
    }

    return result;
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