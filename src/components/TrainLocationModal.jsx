import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { X, Navigation, RefreshCw, Clock } from 'lucide-react';
import { getVehiclePositionByTripId, getTripUpdateByTripId } from '../services/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon } from 'leaflet';
import { Train } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const TrainLocationModal = ({ journey, onClose }) => {
    const [vehicle, setVehicle] = useState(null);
    const [tripUpdate, setTripUpdate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const getRealtimeTripId = (journey) => {
        if (!journey?.legs) return null;
        const transportLegs = journey.legs.filter(leg => {
            const productClass = leg?.transportation?.product?.class;
            return productClass !== undefined && productClass !== 100 && productClass !== 99;
        });
        if (transportLegs.length === 0) return null;
        return transportLegs[0]?.transportation?.properties?.RealtimeTripId || null;
    };

    const getOrigin = () => {
        if (!journey?.legs?.[0]?.origin) return null;
        const origin = journey.legs[0].origin;
        return {
            name: origin.name || origin.disassembledName || 'Origin',
            coord: origin.coord || null
        };
    };

    const getDestination = () => {
        if (!journey?.legs) return null;
        const lastLeg = journey.legs[journey.legs.length - 1];
        const dest = lastLeg?.destination;
        if (!dest) return null;
        return {
            name: dest.name || dest.disassembledName || 'Destination',
            coord: dest.coord || null
        };
    };

    useEffect(() => {
        const fetchVehicle = async () => {
            setLoading(true);
            setError(null);

            const tripId = getRealtimeTripId(journey);
            if (!tripId) {
                setError('No real-time trip ID available for this journey');
                setLoading(false);
                return;
            }

            try {

                // Fetch both vehicle position and trip updates in parallel
                const [vehicleTrain, updateTrain] = await Promise.all([
                    getVehiclePositionByTripId(tripId, 'train'),
                    getTripUpdateByTripId(tripId, 'train')
                ]);

                // If not found, try metro
                let vehicle = vehicleTrain;
                let update = updateTrain;

                if (!vehicle && !update) {
                    const [vehicleMetro, updateMetro] = await Promise.all([
                        getVehiclePositionByTripId(tripId, 'metro'),
                        getTripUpdateByTripId(tripId, 'metro')
                    ]);
                    vehicle = vehicleMetro;
                    update = updateMetro;
                }

                if (vehicle || update) {
                    if (vehicle) setVehicle(vehicle);
                    if (update) setTripUpdate(update);
                } else {
                    setError(`Train location not available in real-time. Trip ID: ${tripId.substring(0, 20)}...`);
                }
            } catch (err) {
                console.error('Error fetching vehicle position:', err);
                setError(`Failed to load train location: ${err.message || 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        };

        fetchVehicle();

        // Refresh every 10 seconds
        const interval = setInterval(fetchVehicle, 10000);
        return () => clearInterval(interval);
    }, [journey]);

    const origin = getOrigin();
    const destination = getDestination();
    const vehiclePosition = vehicle?.vehicle?.position;

    // Determine map center
    let center = [-33.8688, 151.2093]; // Sydney default
    let zoom = 13;

    if (vehiclePosition) {
        center = [vehiclePosition.latitude, vehiclePosition.longitude];
        zoom = 14;
    } else if (origin?.coord) {
        center = origin.coord;
        zoom = 13;
    }

    // Create train icon
    const trainIcon = divIcon({
        html: renderToStaticMarkup(
            <div style={{
                background: 'white',
                borderRadius: '50%',
                border: '3px solid #F6891F',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
                <Train size={20} color="#F6891F" />
            </div>
        ),
        className: 'custom-train-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });

    const lineName = journey?.legs?.[0]?.transportation?.disassembledName ||
        journey?.legs?.[0]?.transportation?.name ||
        'Train';

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                background: 'var(--bg-color)',
                padding: '16px 20px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 4 }}>
                        {lineName} Live Location
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {origin?.name} → {destination?.name}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <X size={24} />
                </button>
            </div>

            {/* Map Container */}
            <div style={{ flex: 1, position: 'relative' }}>
                {loading && !vehicle && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                        background: 'rgba(26, 26, 26, 0.95)',
                        padding: '16px 24px',
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        color: 'white'
                    }}>
                        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Loading train location...</span>
                    </div>
                )}

                {error && !loading && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                        background: 'rgba(26, 26, 26, 0.95)',
                        padding: '16px 24px',
                        borderRadius: 12,
                        color: 'white',
                        textAlign: 'center',
                        maxWidth: 300
                    }}>
                        <div style={{ marginBottom: 8 }}>{error}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                            Real-time location may not be available for this service
                        </div>
                    </div>
                )}

                <MapContainer
                    center={center}
                    zoom={zoom}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Origin Marker */}
                    {origin?.coord && (
                        <Marker position={origin.coord}>
                            <Popup>
                                <div style={{ fontWeight: 'bold' }}>Origin: {origin.name}</div>
                            </Popup>
                        </Marker>
                    )}

                    {/* Destination Marker */}
                    {destination?.coord && (
                        <Marker position={destination.coord}>
                            <Popup>
                                <div style={{ fontWeight: 'bold' }}>Destination: {destination.name}</div>
                            </Popup>
                        </Marker>
                    )}

                    {/* Train Location Marker */}
                    {vehiclePosition && (
                        <Marker
                            position={[vehiclePosition.latitude, vehiclePosition.longitude]}
                            icon={trainIcon}
                        >
                            <Popup>
                                <div style={{ minWidth: 200 }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                        {lineName}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                                        {vehicle?.vehicle?.vehicle?.label || 'Live Location'}
                                    </div>
                                    {vehicle?.vehicle?.trip && (
                                        <div style={{ fontSize: 11, color: '#888' }}>
                                            Trip: {vehicle.vehicle.trip.tripId}
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                </MapContainer>

                {/* Info Overlay */}
                {(vehiclePosition || tripUpdate) && (
                    <div style={{
                        position: 'absolute',
                        bottom: 20,
                        left: 20,
                        right: 20,
                        background: 'rgba(26, 26, 26, 0.95)',
                        padding: '12px 16px',
                        borderRadius: 8,
                        zIndex: 1000,
                        color: 'white',
                        fontSize: 13
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            {vehiclePosition ? <Navigation size={16} /> : <Clock size={16} />}
                            <span style={{ fontWeight: 'bold' }}>
                                {vehiclePosition ? 'Live Location Active' : 'Trip Updates Available'}
                            </span>
                        </div>
                        {tripUpdate?.tripUpdate?.stopTimeUpdate && tripUpdate.tripUpdate.stopTimeUpdate.length > 0 && (() => {
                            // Get the next stop update to show delay
                            const nextStop = tripUpdate.tripUpdate.stopTimeUpdate.find(stop =>
                                stop.arrival?.delay || stop.departure?.delay
                            );
                            const delay = nextStop?.arrival?.delay || nextStop?.departure?.delay || 0;
                            const delayMinutes = Math.round(delay / 60);

                            return (
                                <>
                                    {delay !== 0 && (
                                        <div style={{ fontSize: 12, marginBottom: 4, color: delay > 0 ? '#ff6b6b' : '#51cf66' }}>
                                            {delay > 0 ? 'Delayed' : 'Ahead of schedule'}: {Math.abs(delayMinutes)} min
                                        </div>
                                    )}
                                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                                        {tripUpdate.tripUpdate.stopTimeUpdate.length} stop updates available
                                    </div>
                                </>
                            );
                        })()}
                        <div style={{ fontSize: 11, color: '#888' }}>
                            Updates every 10s • Last updated: {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .leaflet-container {
                    background: #1a1a1a;
                }
            `}</style>
        </div>
    );
};

export default TrainLocationModal;
