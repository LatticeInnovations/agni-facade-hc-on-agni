const ServiceMode = require("../class/ServiceMode");
const axios = require("axios");
const config = require("../config/nodeConfig");
const { serviceModeSchema, serviceModeUpdateSchema } = require("../utils/Validator/campaign/serviceModeValidator");
const { validateRequest } = require("../utils/validateRequest");
const bundleStructure = require("../services/bundleOperation")
const { fetchResource, buildFHIRResource, getTransformedResult } = require("../services/helperFunctions");
const { v4: uuidv4 } = require("uuid");
const { serviceModeSystemUrl } = require("../utils/heartcareSystemUrl");

const mapApiStatusToFHIR = (status) => {
    if (!status) return null;

    const map = {
        active: "active",
        inactive: "retired"
    };

    return map[status.toLowerCase()];
};
const normalizeToArray = (body) => {
    return Array.isArray(body) ? body : [body];
};

const checkDuplicateServiceMode = async (name, token) => {
    const existing = await fetchResource(
        "ActivityDefinition",
        { name, _count: 1000, topic: "SERVICE_MODE" },
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

        await checkDuplicateServiceMode(req.body[0].name, token);

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

const fetchServiceModes = async (token, filters = {}) => {
    let allEntries = [];
    let page = 1;
    let hasNext = true;

    const baseParams = {
       topic: "SERVICE_MODE",
        _count: 200,
        ...filters
    };

    while (hasNext) {
        const response = await fetchResource(
            "ActivityDefinition",
            {
                ...baseParams,
                _page: page
            },
            token
        );

        console.log(`Fetched page ${page}`);

        if (response.entry) {
            allEntries.push(...response.entry);
        }

        const nextLink = response.link?.find(l => l.relation === "next");

        if (nextLink) {
            page++;
        } else {
            hasNext = false;
        }
    }

    return allEntries;
};

let getServiceModeList = async function (req, res) {
    try {
        const token = req.accessToken;
        const { _lastUpdated, status } = req.query;

        const filters = {};
        if (_lastUpdated) filters._lastUpdated = _lastUpdated;
        if (status) {
            const fhirStatus = mapApiStatusToFHIR(status.toLowerCase());
            filters.status = fhirStatus;
        }

        let entries = await fetchServiceModes(token, filters);

        let result = entries.map(e => e.resource).map(resource => {
            const coding = resource.code?.coding?.find(
                c => c.system === serviceModeSystemUrl
            );

            return {
                id: resource.id,
                name: coding?.display || resource.name || null,
                code: coding?.code || null,
                status: resource.status == "active" ? "ACTIVE" : "INACTIVE",
                lastUpdated: resource.meta?.lastUpdated
            };
        });

        result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        return res.status(200).json({
            status: 1,
            message: "Service mode list fetched successfully",
            data: result
        });

    } catch (e) {
        console.error("Error fetching service modes:", e.message);

        return res.status(500).json({
            status: 0,
            message: "Failed to fetch service mode list"
        });
    }
};

let getServiceModeDetails = async function (req, res) {
    try {
        const token = req.accessToken;
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 0,
                message: "Service mode id is required"
            });
        }
        const response = await fetchResource(
            "ActivityDefinition",
            { _id: id },
            token
        );
        const resource = response.entry?.[0]?.resource;
        if (!resource) {
            return res.status(404).json({
                status: 0,
                message: "Service mode not found"
            });
        }
        const coding = resource.code?.coding?.find(
            c => c.system === serviceModeSystemUrl
        );

        if (!coding) {
            return res.status(404).json({
                status: 0,
                message: "Service mode not found"
            });
        }
        let fhirStatus = mapApiStatusToFHIR(resource.status.toLowerCase()) || null;
        const result = {
            id: resource.id,
            name: coding.display || resource.name || null,
            code: coding.code || null,
            status: fhirStatus == "active" ? "ACTIVE" : "INACTIVE",
            lastUpdated: resource.meta?.lastUpdated,
            description: resource.description || null  
        };

        return res.status(200).json({
            status: 1,
            message: "Service mode details fetched successfully",
            data: result
        });

    } catch (e) {
        console.error("Error fetching service mode details:", e.message);

        if (e.response?.status === 404) {
            return res.status(404).json({
                status: 0,
                message: "Service mode not found"
            });
        }

        return res.status(500).json({
            status: 0,
            message: "Failed to fetch service mode details"
        });
    }
};

module.exports = { saveServiceMode, updateServiceMode, getServiceModeList, getServiceModeDetails };