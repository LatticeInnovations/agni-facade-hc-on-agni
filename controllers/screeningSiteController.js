const ScreeningSite = require("../class/ScreeningSite");
const PractitionerRole = require("../class/practitionerRole");
const axios = require("axios");
const config = require("../config/nodeConfig");
const { screeningSiteSchema } = require("../utils/Validator/campaign/screeningSiteValidatior");
const { validateRequest } = require("../utils/validateRequest");
const bundleStructure = require("../services/bundleOperation");
const { fetchResource, buildFHIRResource } = require("../services/helperFunctions");
const { v4: uuidv4 } = require("uuid");

const validateBusinessRules = (data) => {
    if (!data.location?.type || !data.location?.value) {
        throw new Error("Location type and value required");
    }

    const headCount = data.staffIds.filter(s => s.isHead).length;
    if (headCount !== 1) {
        throw new Error("Exactly one staff must be Head of Screening Campaign");
    }

    const ids = data.staffIds.map(s => s.id);
    if (ids.length !== new Set(ids).size) {
        throw new Error("Duplicate staff IDs are not allowed");
    }
};

const checkDuplicateSiteName = async (name, token, excludeId = null) => {
    const res = await fetchResource(
        "Location",
        { name, type: "SCREENING_SITE" },
        token
    );

    if (res.entry && res.entry.length > 0) {
        if (!excludeId || res.entry[0].resource.id !== excludeId) {
            throw new Error("Screening site already exists with name: " + name);
        }
    }
};

const buildCreateBundleEntries = async (data, token) => {
    let entries = [];
    const locationUuid = uuidv4();

    const locationResource = buildFHIRResource(ScreeningSite, data);
    const locationEntry = await bundleStructure.setBundlePost(
        locationResource,
        null,
        locationUuid,
        "POST"
    );
    entries.push(locationEntry);

    for (let staff of data.staffIds) {
        const roleObj = {
            userId: staff.id,
            isHead: staff.isHead,
            locationId: locationUuid,
            isScreeningFlow: true
        };
        const roleResource = buildFHIRResource(PractitionerRole, roleObj);
        const roleEntry = await bundleStructure.setBundlePost(
            roleResource,
            null,
            uuidv4(),
            "POST"
        );
        entries.push(roleEntry);
    }

    return entries;
};

const getIdFromLocation = (location) => {
    return location?.split("/")[1];
};

const createScreeningSite = async (req, res) => {
    try {
        const validated = validateRequest(req.body, screeningSiteSchema, res);
        if (!validated) return;

        const token = req.accessToken;
        const data = req.body;

        validateBusinessRules(data);
        await checkDuplicateSiteName(data.name, token);

        const resourceResult = await buildCreateBundleEntries(data, token);
        const bundleData = await bundleStructure.getBundleJSON({ resourceResult });

        const response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/fhir+json"
            }
        });

        const locationId = getIdFromLocation(response.data.entry[0].response.location);

        return res.status(201).json({
            status: 1,
            message: "Screening site created successfully",
            data: {
                locationId,
                assignedStaff: data.staffIds.map(s => s.id)
            }
        });

    } catch (err) {
        console.error("Error creating screening site:", err);
        return res.status(400).json({
            status: 0,
            message: err.message
        });
    }
}

module.exports = {
    createScreeningSite
};