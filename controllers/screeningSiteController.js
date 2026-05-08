const ScreeningSite = require("../class/ScreeningSite");
const PractitionerRole = require("../class/practitionerRole");
const axios = require("axios");
const config = require("../config/nodeConfig");
const { screeningSiteSchema, screeningSiteUpdateSchema } = require("../utils/Validator/campaign/screeningSiteValidatior");
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

const getParentLocationId = async (data, token) => {

    if (data.location?.type === "FREE_TEXT") {
        return null;
    }

    if (data.location?.type === "AREA_COUNCIL") {
        const res = await fetchResource(
            "Location",
            {
                type: "area-council",
                _id: data.location.value
            },
            token
        );

        if (!res.entry || res.entry.length === 0) {
            throw new Error(`Parent location not found: ${data.location.value}`);
        }

        return res.entry[0].resource.id;
    }
    throw new Error(`Invalid location type: ${data.location?.type}`);
};

const buildCreateBundleEntries = async (data, token, parentLocationId) => {
    let entries = [];
    const locationUuid = uuidv4();

    const locationResource = buildFHIRResource(ScreeningSite, data);
    if (parentLocationId) {
        locationResource.partOf = {
            reference: `Location/${parentLocationId}`
        };
    }
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

const getAllServiceModes = async (token) => {
    const response = await fetchResource(
        "ActivityDefinition",
        { topic: "SERVICE_MODE", _count: 1000 },
        token
    );

    const map = {};

    for (const entry of response.entry || []) {
        const resource = entry.resource;

        const coding = resource.code?.coding?.find(
            c => c.system === "http://example.org/service-mode"
        );

        if (coding?.display) {
            map[coding.display] = resource.id;
        }
    }

    console.log("Service mode map:", JSON.stringify(map));
    return map;
};

const getServiceModeId = async (serviceModeCode, token) => {
    if (!serviceModeCode) return "";

    try {
        const response = await fetchResource(
            "ActivityDefinition",
            { topic: "SERVICE_MODE", _count: 1000 },
            token
        );

        for (const entry of response.entry || []) {
            const resource = entry.resource;

            const coding = resource.code?.coding?.find(
                c => c.system === "http://heartcare.vu/service-mode"
            );

            if (coding?.display === serviceModeCode) {
                return resource.id;
            }
        }

        return "";
    } catch (e) {
        console.error(e);
        return "";
    }
};

const getStaffDetails = async (staffRoles, token) => {
    const staffDetails = [];

    if (!staffRoles.length) return staffDetails;

    const practitionerIds = new Set();

    for (const roleEntry of staffRoles) {
        const roleResource = roleEntry?.resource || roleEntry;

        const practitionerRef = roleResource?.practitioner?.reference;
        if (practitionerRef) {
            const id = practitionerRef.split("/")[1];
            practitionerIds.add(id);
        }
    }

    let practitionerMap = {};

    if (practitionerIds.size > 0) {
        const practitionerResponse = await fetchResource(
            "Practitioner",
            { _id: [...practitionerIds].join(",") },
            token
        );

        for (const entry of practitionerResponse.entry || []) {
            practitionerMap[entry.resource.id] = entry.resource;
        }
    }

    for (const roleEntry of staffRoles) {
        const roleResource = roleEntry?.resource || roleEntry;

        if (!roleResource) continue;
        if (roleResource.active === false) continue;
        const isScreeningStaff = roleResource.code?.some(c =>
            c?.coding?.some(cd => cd?.code === "SCREENING_STAFF")
        );

        if (!isScreeningStaff) continue;

        const isHeadExt = roleResource.extension?.find(
            e => e.url === "http://heartcare.vu/StructureDefinition/is-leader"
        );
        const isTeamLead = isHeadExt?.valueBoolean || false;

        const practitionerRef = roleResource.practitioner?.reference;
        if (!practitionerRef) continue;

        const practitionerId = practitionerRef.split("/")[1];

        const practitionerResource = practitionerMap[practitionerId];
        if (!practitionerResource) continue;

        let mobile = "";
        let email = "";

        if (practitionerResource.telecom) {
            const phoneEntry = practitionerResource.telecom.find(t => t.system === "phone");
            const emailEntry = practitionerResource.telecom.find(t => t.system === "email");

            if (phoneEntry) mobile = phoneEntry.value || "";
            if (emailEntry) email = emailEntry.value || "";
        }

        const nameObj = practitionerResource.name?.[0];
        let name = "Unknown";

        if (nameObj) {
            if (nameObj.text) {
                name = nameObj.text;
            } else {
                const given = Array.isArray(nameObj.given)
                    ? nameObj.given.join(" ")
                    : (nameObj.given || "");

                const family = nameObj.family || "";
                name = `${given} ${family}`.trim() || "Unknown";
            }
        }

        staffDetails.push({
            id: practitionerId,
            name: name,
            mobile: mobile,
            email: email,
            isTeamLead: isTeamLead
        });
    }

    return staffDetails;
};

const createScreeningSite = async (req, res) => {
    try {
        const validated = validateRequest(req.body, screeningSiteSchema, res);
        if (!validated) return;

        const token = req.accessToken;
        const data = req.body;

        validateBusinessRules(data);
        await checkDuplicateSiteName(data.name, token);
        const parentLocationId = await getParentLocationId(data, token);
        const resourceResult = await buildCreateBundleEntries(data, token, parentLocationId);
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
};

const listScreeningSites = async (req, res) => {
    try {
        const token = req.accessToken;
        const { status, _page = 1, _count = 50 } = req.query;

        const query = {
            type: "SCREENING_SITE",
            _page,
            _count
        };

        if (status) query.status = status;
        if (req.query._lastUpdated) query._lastUpdated = req.query._lastUpdated;
        if (req.query._sort) query._sort = req.query._sort;

        const locationResponse = await fetchResource("Location", query, token);

        if (!locationResponse.entry) {
            return res.status(200).json({
                status: 1,
                data: []
            });
        }

        const entries = locationResponse.entry;

        const serviceModeMap = await getAllServiceModes(token);

        const councilIds = new Set();
        const locationIds = [];

        const siteMap = {}; 

        for (const entry of entries) {
            const locationResource = entry.resource;
            const site = new ScreeningSite({}, locationResource);

            siteMap[locationResource.id] = site;
            locationIds.push(locationResource.id);

            const locationData = site.getLocation();

            if (locationData?.type === "AREA_COUNCIL") {
                councilIds.add(locationData.value);
            }
        }

        let councilMap = {};
        if (councilIds.size > 0) {
            const councilResponse = await fetchResource(
                "Location",
                { _id: [...councilIds].join(",") },
                token
            );

            for (const entry of councilResponse.entry || []) {
                const res = entry.resource;
                councilMap[res.id] = res;
            }
        }
        let rolesByLocation = {};

        const practitionerRoleResponse = await fetchResource(
            "PractitionerRole",
            { location: locationIds.join(","), _count: 5000 },
            token
        );

        for (const entry of practitionerRoleResponse.entry || []) {
            const role = entry.resource;

            const locRef = role.location?.[0]?.reference;
            if (!locRef) continue;

            const locId = locRef.split("/")[1];

            if (!rolesByLocation[locId]) {
                rolesByLocation[locId] = [];
            }

            rolesByLocation[locId].push(role);
        }

        const sites = [];

        for (const entry of entries) {
            const locationResource = entry.resource;
            const site = siteMap[locationResource.id];

            const locationData = site.getLocation();

            let location = "";
            let areaCouncil = "";
            let areaCouncilId = "";

            if (locationData?.type === "FREE_TEXT") {
                location = locationData.value || "";
            } else if (locationData?.type === "AREA_COUNCIL") {
                const councilRef = locationData.value;
                const councilResource = councilMap[councilRef];

                areaCouncil = councilResource?.name || councilRef;
                areaCouncilId = councilResource?.id || councilRef;
            }

            const staffRoles = rolesByLocation[locationResource.id] || [];
            const staff = await getStaffDetails(staffRoles, token);

            const serviceMode = site.getServiceMode() || "";
            const fromDate = site.getStartDate();
            const toDate = site.getEndDate();

            let status = locationResource.status || "unknown";
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (toDate && new Date(toDate) < today) {
                status = "closed";
            } else if (fromDate && new Date(fromDate) > today) {
                status = "upcoming";
            }

            sites.push({
                id: locationResource.id,
                name: locationResource.name || "",
                location: location,
                areaCouncil: areaCouncil,
                areaCouncilId: areaCouncilId,
                serviceMode: serviceMode,
                serviceModeId: serviceModeMap[serviceMode] || "",
                fromDate: fromDate || "",
                toDate: toDate || "",
                status: status,
                lastUpdated: locationResource.meta?.lastUpdated || "",
                staff: staff
            });
        }

        return res.status(200).json({
            status: 1,
            data: sites,
            total: locationResponse.total || sites.length
        });

    } catch (err) {
        console.error("Error listing screening sites:", err);
        return res.status(500).json({
            status: 0,
            message: err.message
        });
    }
};

const getScreeningSite = async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.accessToken;

        const locationResponse = await fetchResource("Location", { _id: id }, token);
        if (!locationResponse.entry?.length) {
            return res.status(404).json({
                status: 0,
                message: "Screening site not found"
            });
        }

        const locationResource = locationResponse.entry[0].resource;
        const site = new ScreeningSite({}, locationResource);
        const locationData = site.getLocation();

        let location = "";
        let areaCouncil = "";
        let areaCouncilId = "";

        if (locationData?.type === "FREE_TEXT") {
            location = locationData.value || "";
        } else if (locationData?.type === "AREA_COUNCIL") {
            try {
                const councilResponse = await fetchResource("Location", { _id: locationData.value }, token);
                const councilResource = councilResponse.entry?.[0]?.resource;
                areaCouncil = councilResource?.name || locationData.value;
                areaCouncilId = councilResource?.id || locationData.value;
            } catch (e) {
                console.error("Error fetching area council:", e);
                areaCouncil = locationData.value;
                areaCouncilId = locationData.value;
            }
        }

        const staffResponse = await fetchResource(
            "PractitionerRole",
            { location: id },
            token
        );

        const staffRoles = staffResponse?.entry || [];
        const staff = await getStaffDetails(staffRoles, token);
        const serviceModeMap = await getAllServiceModes(token);
        const serviceMode = site.getServiceMode() || "";
        const serviceModeId = serviceModeMap[serviceMode] || "";
        const fromDate = site.getStartDate();
        const toDate = site.getEndDate();

        let status = locationResource.status || "unknown";
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (toDate && new Date(toDate) < today) {
            status = "closed";
        } else if (fromDate && new Date(fromDate) > today) {
            status = "upcoming";
        }

        return res.status(200).json({
            status: 1,
            data: {
                id: locationResource.id,
                name: locationResource.name || "",
                location: location,
                areaCouncil: areaCouncil,
                areaCouncilId: areaCouncilId,
                serviceMode: serviceMode,
                serviceModeId: serviceModeId,
                fromDate: fromDate || "",
                toDate: toDate || "",
                status: status,
                lastUpdated: locationResource.meta?.lastUpdated || "",
                staff: staff
            }
        });

    } catch (err) {
        console.error("Error fetching screening site:", err);
        return res.status(500).json({
            status: 0,
            message: err.message
        });
    }
};

const updateScreeningSite = async (req, res) => {
    try {
        let id = req.body.id;

        const validated = validateRequest(req.body, screeningSiteUpdateSchema, res);
        if (!validated) return;

        const token = req.accessToken;
        const data = req.body;

        validateBusinessRules(data);
        await checkDuplicateSiteName(data.name, token, id);

        const existingLocation = await fetchResource("Location", { _id: id }, token);
        if (!existingLocation.entry?.length) {
            return res.status(404).json({
                status: 0,
                message: "Screening site not found"
            });
        }

        const parentLocationId = await getParentLocationId(data, token);

        const locationUuid = uuidv4();

        let locationResource = buildFHIRResource(ScreeningSite, data);
        locationResource.id = id;
        delete locationResource.meta;

        if (parentLocationId) {
            locationResource.partOf = {
                reference: `Location/${parentLocationId}`
            };
        } else {
            delete locationResource.partOf;
        }

        const locationEntry = {
            fullUrl: `urn:uuid:${locationUuid}`,
            resource: locationResource,
            request: {
                method: "PUT",
                url: `Location/${id}`
            }
        };

        const entries = [locationEntry];

        const oldRoles = await fetchResource(
            "PractitionerRole",
            { location: id },
            token
        );

        const existingRoleMap = {};

        if (oldRoles.entry) {
            for (const role of oldRoles.entry) {
                const resource = role.resource;

                const isScreeningStaff = resource.code?.some(c =>
                    c?.coding?.some(cd => cd.code === "SCREENING_STAFF")
                );

                if (!isScreeningStaff) continue;

                const practitionerRef = resource.practitioner?.reference;
                if (!practitionerRef) continue;

                const practitionerId = practitionerRef.split("/")[1];
                existingRoleMap[practitionerId] = resource;
            }
        }


        for (const practitionerId in existingRoleMap) {
            const existsInNew = data.staffIds.some(s => s.id === practitionerId);

            if (!existsInNew) {
                const roleResource = existingRoleMap[practitionerId];

                roleResource.active = false;

                roleResource.location = [
                    {
                        reference: `urn:uuid:${locationUuid}`
                    }
                ];

                delete roleResource.meta;

                const updateEntry = await bundleStructure.setBundlePut(
                    roleResource,
                    null,
                    roleResource.id,
                    "PUT"
                );

                entries.push(updateEntry);
            }
        }

        for (const staff of data.staffIds) {
            const existingRole = existingRoleMap[staff.id];

            if (existingRole) {
                existingRole.active = true;

                existingRole.extension = [
                    {
                        url: "http://heartcare.vu/StructureDefinition/is-leader",
                        valueBoolean: staff.isHead
                    }
                ];

                existingRole.location = [
                    {
                        reference: `urn:uuid:${locationUuid}`
                    }
                ];

                delete existingRole.meta;

                const updateEntry = await bundleStructure.setBundlePut(
                    existingRole,
                    null,
                    existingRole.id,
                    "PUT"
                );

                entries.push(updateEntry);

            } else {
                const roleObj = {
                    userId: staff.id,
                    isHead: staff.isHead,
                    locationId: locationUuid,
                    isScreeningFlow: true,
                    useUuid: true
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
        }

        const bundleData = await bundleStructure.getBundleJSON({
            resourceResult: entries
        });

        await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/fhir+json"
            }
        });

        return res.status(200).json({
            status: 1,
            message: "Screening site updated successfully",
            data: { locationId: id }
        });

    } catch (err) {
        console.error("Error updating screening site:", err);
        return res.status(400).json({
            status: 0,
            message: err.message
        });
    }
};

const deleteScreeningSite = async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.accessToken;

        // Check if screening site exists
        const existingLocation = await fetchResource("Location", { _id: id }, token);
        if (!existingLocation.entry?.length) {
            return res.status(404).json({
                status: 0,
                message: "Screening site not found"
            });
        }

        const locationResource = existingLocation.entry[0].resource;

        // Verify it's a screening site
        const isScreeningSite = locationResource.type?.some(t =>
            t.coding?.some(c => c.code === "SCREENING_SITE")
        );

        if (!isScreeningSite) {
            return res.status(400).json({
                status: 0,
                message: "Cannot delete: Not a screening site"
            });
        }

        const site = new ScreeningSite({}, locationResource);
        const toDate = site.getEndDate();

        // Rule 1: Check if campaign To Date has passed
        if (!toDate || new Date(toDate) > new Date()) {
            return res.status(400).json({
                status: 0,
                message: "Cannot delete: Campaign end date has not passed yet"
            });
        }

        // Rule 2: Check if any patient screening data (Encounter) is attached to this site
        const encounterResponse = await fetchResource(
            "Encounter",
            { location: id, _count: 1 },
            token
        );

        if (encounterResponse.entry && encounterResponse.entry.length > 0) {
            return res.status(400).json({
                status: 0,
                message: "Cannot delete: Screening site has patient screening data attached"
            });
        }

        // Build bundle entries for hard delete
        const entries = [];

        // Delete location resource using DELETE method
        const locationEntry = {
            fullUrl: `urn:uuid:${uuidv4()}`,
            request: {
                method: "DELETE",
                url: `Location/${id}`
            }
        };
        entries.push(locationEntry);

        // Get and delete all PractitionerRole resources for this location
        const practitionerRoleResponse = await fetchResource(
            "PractitionerRole",
            { location: id },
            token
        );

        if (practitionerRoleResponse.entry) {
            for (const roleEntry of practitionerRoleResponse.entry) {
                const roleResource = roleEntry.resource;

                // Only delete screening staff roles
                const isScreeningStaff = roleResource.code?.some(c =>
                    c.coding?.some(cd => cd.code === "SCREENING_STAFF")
                );

                if (isScreeningStaff) {
                    const roleDeleteEntry = {
                        fullUrl: `urn:uuid:${uuidv4()}`,
                        request: {
                            method: "DELETE",
                            url: `PractitionerRole/${roleResource.id}`
                        }
                    };
                    entries.push(roleDeleteEntry);
                }
            }
        }

        const bundleData = await bundleStructure.getBundleJSON({ resourceResult: entries });

        await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/fhir+json"
            }
        });

        return res.status(200).json({
            status: 1,
            message: "Screening site deleted successfully",
            data: { locationId: id }
        });

    } catch (err) {
        console.error("Error deleting screening site:", err);
        return res.status(400).json({
            status: 0,
            message: err.message
        });
    }
};

module.exports = {
    createScreeningSite,
    updateScreeningSite,
    getScreeningSite,
    listScreeningSites,
    deleteScreeningSite
};