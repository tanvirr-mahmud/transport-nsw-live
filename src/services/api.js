import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const BASE_URL = '/api/v1/tp';

const getApiKey = (scope = 'tp') => {
  const apiKey = import.meta.env.VITE_TFNSW_API_KEY;
  const gtfsKey = import.meta.env.VITE_TFNSW_GTFS_API_KEY;
  const tripUpdatesKey = import.meta.env.VITE_TFNSW_TRIP_UPDATES_API_KEY;
  const vehiclePosKey = import.meta.env.VITE_TFNSW_VEHICLE_POS_API_KEY;

  if (scope === 'gtfs' || scope === 'vehicle_pos') {
    // Vehicle positions API key
    return vehiclePosKey || gtfsKey || apiKey;
  } else if (scope === 'trip_updates' || scope === 'realtime') {
    // Trip updates/realtime API key
    return tripUpdatesKey || gtfsKey || apiKey;
  }
  return apiKey;
};

const headers = (apiKey) => {
  const base = { 'Content-Type': 'application/json' };
  if (!apiKey) return base;
  return {
    ...base,
    'Authorization': `apikey ${apiKey}`
  };
};

export const searchLocations = async (query) => {
  if (!query) return [];
  const apiKey = getApiKey('tp');
  if (!apiKey) throw new Error("API Key missing");

  // Reverting to type_sf=any because type_sf=stop might be returning strict exact matches or failing
  // We will filter client-side instead.
  const response = await fetch(`${BASE_URL}/stop_finder?outputFormat=rapidJSON&type_sf=any&name_sf=${encodeURIComponent(query)}&coordOutputFormat=EPSG:4326&TfNSWSF=true&version=10.2.1.42`, {
    headers: headers(apiKey)
  });

  if (!response.ok) {
    throw new Error('Failed to fetch locations');
  }

  const data = await response.json();
  const rawLocations = data.locations || [];

  // Filter for Stops/Stations only
  // Logic: Must be type 'stop' OR have a 'disassembledName' (usually stations)
  // We exclude 'poi' (Points of Interest), 'street', 'locality' etc if possible.
  return rawLocations.filter(loc => {
    // Keep if it is explicitly a stop/platform
    if (loc.type === 'stop' || loc.type === 'platform') return true;
    // If type is generic but it has a stopId (globalId), it's likely a transport node
    if (loc.isGlobalId) return true;
    // Heuristic: Name contains "Station" or "Wharf" or "Stop"
    if (loc.name?.match(/(Station|Wharf|Stop|Interchange)/i)) return true;

    return false;
  });
};

export const getTrips = async (originId, destinationId, date = new Date(), options = {}) => {
  const apiKey = getApiKey('tp');
  if (!apiKey) throw new Error("API Key missing");

  const yzDate = getYzDate(date);
  const yzTime = getYzTime(date);
  const { count = 100 } = options;

  // trip endpoint
  // calcNumberOfTrips=100 : Increased to ensure we cover ~3 hours even during peak times
  const response = await fetch(`${BASE_URL}/trip?outputFormat=rapidJSON&coordOutputFormat=EPSG:4326&depArrMacro=dep&itdDate=${yzDate}&itdTime=${yzTime}&type_origin=any&name_origin=${originId}&type_destination=any&name_destination=${destinationId}&calcNumberOfTrips=${count}&version=10.2.1.42`, {
    headers: headers(apiKey)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`Trip API error (${response.status}):`, errorText);
    throw new Error(`Failed to fetch trips: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Check for API-level errors in response
  if (data.systemMessages && data.systemMessages.length > 0) {
    const errors = data.systemMessages.filter(msg => msg.type === 'error');
    if (errors.length > 0) {
      console.warn('API system messages:', errors);
    }
  }

  return data.journeys || [];
};

// Helper for date formatting YYYYMMDD
const getYzDate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// Helper for time formatting HHMM
const getYzTime = (date = new Date()) => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}${m}`;
}

// Get real-time departures for a stop
export const getDepartures = async (stopId, transportMode = 'any') => {
  const apiKey = getApiKey('tp');
  if (!apiKey) throw new Error("API Key missing");

  // Using departure_mon endpoint for real-time departures
  const response = await fetch(`${BASE_URL}/departure_mon?outputFormat=rapidJSON&coordOutputFormat=EPSG:4326&mode=direct&type_dm=stop&name_dm=${stopId}&departureMonitorMacro=true&itdDateTimeDepArr=dep&version=10.2.1.42`, {
    headers: headers(apiKey)
  });

  if (!response.ok) {
    throw new Error('Failed to fetch departures');
  }

  const data = await response.json();
  return data.stopEvents || [];
};

// Get live vehicle positions (GTFS Realtime)
export const getVehiclePositions = async (transportMode = 'bus') => {
  const apiKey = getApiKey('vehicle_pos');
  if (!apiKey) {
    console.warn('Vehicle Position API key missing; skipping vehicle positions.');
    return [];
  }

  // Map internal transport modes to API endpoints (based on getvehicleposition_8.0.yaml)
  let endpointMode = 'buses';
  switch (transportMode) {
    case 'train':
    case 'metro':
      endpointMode = 'nswtrains'; // Both trains and metro use nswtrains endpoint
      break;
    case 'ferry':
      endpointMode = 'ferries/sydneyferries'; // Default to Sydney Ferries
      break;
    case 'lightrail':
      endpointMode = 'lightrail/cbdandsoutheast'; // Default to CBD & South East
      break;
    case 'bus':
    default:
      endpointMode = 'buses';
      break;
  }

  try {
    // Vehicle Position API endpoint via proxy: /api/v1/gtfs/vehiclepos/{mode}
    const response = await fetch(`/api/v1/gtfs/vehiclepos/${endpointMode}`, {
      headers: {
        'Authorization': `apikey ${apiKey}`
      }
    });

    if (!response.ok) {
      console.error(`Status ${response.status} for ${endpointMode}`);
      return [];
    }

    const buffer = await response.arrayBuffer();
    // Decode protobuf
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    return feed.entity.map(e => {
      if (!e.vehicle) return null;
      return {
        id: e.id,
        vehicle: e.vehicle,
        mode: transportMode
      };
    }).filter(Boolean);

  } catch (err) {
    console.warn(`Failed to fetch vehicles for ${transportMode}:`, err);
    return [];
  }
};

// Get real-time trip updates (GTFS Realtime Trip Updates feed)
export const getTripUpdates = async (transportMode = 'train') => {
  const apiKey = getApiKey('realtime');
  if (!apiKey) {
    console.warn('Realtime Trip Updates API key missing');
    return [];
  }

  // Map internal transport modes to API endpoints (based on getrealtime_8.0.yaml)
  let endpointMode = 'buses';
  switch (transportMode) {
    case 'train':
    case 'metro':
      endpointMode = 'nswtrains'; // Both trains and metro use nswtrains endpoint
      break;
    case 'ferry':
      endpointMode = 'ferries/sydneyferries'; // Default to Sydney Ferries
      break;
    case 'lightrail':
      endpointMode = 'lightrail/cbdandsoutheast'; // Default to CBD & South East
      break;
    case 'bus':
    default:
      endpointMode = 'buses';
      break;
  }

  try {
    // Trip Updates API endpoint via proxy: /api/v1/gtfs/realtime/{mode}
    const response = await fetch(`/api/v1/gtfs/realtime/${endpointMode}`, {
      headers: {
        'Authorization': `apikey ${apiKey}`
      }
    });

    if (!response.ok) {
      console.error(`Status ${response.status} for trip updates ${endpointMode}`);
      return [];
    }

    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    return feed.entity
      .filter(e => e.tripUpdate)
      .map(e => ({
        id: e.id,
        tripUpdate: e.tripUpdate,
        mode: transportMode
      }));
  } catch (err) {
    console.warn(`Failed to fetch trip updates for ${transportMode}:`, err);
    return [];
  }
};

// Get real-time trip update for a specific trip by RealtimeTripId
export const getTripUpdateByTripId = async (realtimeTripId, transportMode = 'train') => {
  try {
    if (!realtimeTripId) return null;

    const allUpdates = await getTripUpdates(transportMode);

    // RealtimeTripId format is like "96-N.1260.166.36.A.8.88166633"
    // Extract key parts for matching
    const tripIdParts = realtimeTripId.split('.');
    const tripIdSuffix = tripIdParts.length > 0 ? tripIdParts[tripIdParts.length - 1] : null;
    const tripIdPrefix = tripIdParts.length > 1 ? tripIdParts[0] : null;

    // Find trip update matching the trip ID
    const update = allUpdates.find(u => {
      if (!u.tripUpdate?.trip) return false;

      const updateTripId = u.tripUpdate.trip.tripId || '';
      const updateRouteId = u.tripUpdate.trip.routeId || '';
      const entityId = u.id || '';

      // Try exact match first
      if (updateTripId === realtimeTripId) return true;

      // Try matching by suffix
      if (tripIdSuffix && (updateTripId.includes(tripIdSuffix) || entityId.includes(tripIdSuffix))) return true;

      // Try matching by prefix
      if (tripIdPrefix && (updateTripId.includes(tripIdPrefix) || entityId.includes(tripIdPrefix))) return true;

      // Try matching in route ID
      if (updateRouteId && realtimeTripId.includes(updateRouteId)) return true;

      return false;
    });

    return update || null;
  } catch (err) {
    console.error(`Failed to find trip update for ${realtimeTripId}:`, err);
    return null;
  }
};

// Get vehicle position for a specific trip by RealtimeTripId
export const getVehiclePositionByTripId = async (realtimeTripId, transportMode = 'train') => {
  try {
    if (!realtimeTripId) return null;

    const allVehicles = await getVehiclePositions(transportMode);

    // RealtimeTripId format is like "96-N.1260.166.36.A.8.88166633"
    // Extract key parts for matching
    const tripIdParts = realtimeTripId.split('.');
    const tripIdSuffix = tripIdParts.length > 0 ? tripIdParts[tripIdParts.length - 1] : null;
    const tripIdPrefix = tripIdParts.length > 1 ? tripIdParts[0] : null;

    // Find vehicle matching the trip ID
    const vehicle = allVehicles.find(v => {
      if (!v.vehicle?.trip) return false;

      const vehicleTripId = v.vehicle.trip.tripId || '';
      const vehicleRouteId = v.vehicle.trip.routeId || '';
      const vehicleLabel = v.vehicle.vehicle?.label || '';
      const entityId = v.id || '';

      // Try exact match first
      if (vehicleTripId === realtimeTripId) return true;

      // Try matching by suffix (last part of trip ID)
      if (tripIdSuffix && (vehicleTripId.includes(tripIdSuffix) || entityId.includes(tripIdSuffix))) return true;

      // Try matching by prefix
      if (tripIdPrefix && (vehicleTripId.includes(tripIdPrefix) || entityId.includes(tripIdPrefix))) return true;

      // Try matching in route ID
      if (vehicleRouteId && realtimeTripId.includes(vehicleRouteId)) return true;

      // Try matching in label
      if (vehicleLabel && (vehicleLabel.includes(realtimeTripId) || (tripIdSuffix && vehicleLabel.includes(tripIdSuffix)))) return true;

      return false;
    });

    return vehicle || null;
  } catch (err) {
    console.error(`Failed to find vehicle for trip ${realtimeTripId}:`, err);
    return null;
  }
};
