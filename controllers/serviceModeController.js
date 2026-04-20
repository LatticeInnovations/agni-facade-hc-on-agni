const ServiceMode = require("../class/ServiceMode");
const axios = require("axios");
const config = require("../config/nodeConfig");
const { serviceModeSchema, serviceModeUpdateSchema } = require("../utils/Validator/campaign/serviceModeValidator");
const { validateRequest } = require("../utils/validateRequest");
const bundleStructure = require("../services/bundleOperation")
const { fetchResource, buildFHIRResource, getTransformedResult } = require("../services/helperFunctions");
const { v4: uuidv4 } = require("uuid");

const normalizeToArray = (body) => {
    return Array.isArray(body) ? body : [body];
};

const checkDuplicateServiceMode = async (name, token) => {
    const existing = await fetchResource(
        "ActivityDefinition",
        { name, _count: 1000 },
        token
    );

    if (existing.total > 0) {
        throw new Error(`Service mode already exists with name: ${name}`);
    }
};

const buildCreateBundleEntries = async (dataArray) => {
    let entries = [];

    for (let item of dataArray) {
        item.code = generateCode(item.name);

        const resource = buildFHIRResource(ServiceMode, item);

        const bundleEntry = await bundleStructure.setBundlePost(
            resource,
            null,
            uuidv4(),
            "POST"
        );

        entries.push(bundleEntry);
    }

    return entries;
};

const buildUpdateBundleEntries = async (dataArray, token) => {
    let entries = [];

    for (let item of dataArray) {

        const existingResponse = await fetchResource(
            "ActivityDefinition",
            { _id: item.id },
            token
        );

        const existingResource = existingResponse?.entry?.[0]?.resource;

        if (!existingResource) {
            throw new Error("Service mode not found");
        }

        const updatedResource = {
            ...existingResource,
            status: new ServiceMode().mapStatus(item.status)
        };

        const bundleEntry = await bundleStructure.setBundlePut(
            updatedResource,
            null,
            item.id,
            "PUT"
        );

        entries.push(bundleEntry);
    }

    return entries;
};

const formatCreateResponse = (entries, requestBody) => {
    return entries.map((entry, i) => ({
        id: getIdFromLocation(entry.response.location),
        code: requestBody[i].code
    }));
};

const formatUpdateResponse = (entries, requestBody) => {
    return entries.map((entry, i) => ({
        id: getIdFromLocation(entry.response.location),
        status: requestBody[i].status
    }));
};
let saveServiceMode = async function (req, res) {
    try {
        req.body = normalizeToArray(req.body);

        const validated = validateRequest(req.body, serviceModeSchema, res);
        if (!validated) return;

        const token = req.accessToken;

        // duplicate check
        for (let item of req.body) {
            await checkDuplicateServiceMode(item.name, token);
        }

        const resourceResult = await buildCreateBundleEntries(req.body);

        const bundleData = await bundleStructure.getBundleJSON({ resourceResult });

        const response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/fhir+json"
            }
        });

        const formatted = formatCreateResponse(response.data.entry, req.body);

        return res.status(201).json({
            status: 1,
            message: "Service mode created successfully",
            data: formatted.length === 1 ? formatted[0] : formatted
        });

    } catch (e) {
        return res.status(400).json({
            status: 0,
            message: e.message
        });
    }
};

const getIdFromLocation = (location) => {
    return location?.split("/")[1];
};
let updateServiceMode = async function (req, res) {
    try {
        req.body = normalizeToArray(req.body);

        const validated = validateRequest(req.body, serviceModeUpdateSchema, res);
        if (!validated) return;

        const token = req.accessToken;

        const resourceResult = await buildUpdateBundleEntries(req.body, token);

        const bundleData = await bundleStructure.getBundleJSON({ resourceResult });

        const response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/fhir+json"
            }
        });

        const formatted = formatUpdateResponse(response.data.entry, req.body);

        return res.status(200).json({
            status: 1,
            message: "Service mode status updated successfully",
            data: formatted.length === 1 ? formatted[0] : formatted
        });

    } catch (e) {
        return res.status(400).json({
            status: 0,
            message: e.message
        });
    }
};
const generateCode = (name) => {
    return name
        .trim()
        .toUpperCase()
        .replaceAll(/[^A-Z0-9 ]/g, "")
        .replaceAll(/\s+/g, "_");
};

module.exports = { saveServiceMode, updateServiceMode };