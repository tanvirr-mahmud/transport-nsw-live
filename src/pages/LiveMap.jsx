import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Train, Bus, TramFront, Ship, Navigation } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon } from 'leaflet';
import { useFilters } from '../context/FilterContext';
import { getVehiclePositions } from '../services/api';
import 'leaflet/dist/leaflet.css';

const LiveMap = () => {
    const { filters } = useFilters();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Sydney coordinates as default center
    const defaultCenter = [-33.8688, 151.2093];

    useEffect(() => {
        let isMounted = true;

        const fetchVehicles = async () => {
            // Determine active modes
            const modes = [];
            if (filters.train) modes.push('train');
            if (filters.metro) modes.push('metro');
            if (filters.bus) modes.push('bus');
            if (filters.lightrail) modes.push('lightrail');
            if (filters.ferry) modes.push('ferry');

            if (modes.length === 0) {
                if (isMounted) {
                    setVehicles([]);
                    setLoading(false);
                }
                return;
            }

            try {
                // Fetch all active modes in parallel
                const results = await Promise.all(modes.map(mode => getVehiclePositions(mode)));
                const allVehicles = results.flat();

                if (isMounted) {
                    setVehicles(allVehicles);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error fetching vehicles:", error);
                if (isMounted) setLoading(false);
            }
        };

        fetchVehicles();
        const interval = setInterval(fetchVehicles, 15000); // Refresh every 15s

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [filters]);

    // Create custom icons for each mode
    const getIcon = (mode) => {
        let IconComponent = Bus;
        let color = '#333';

        switch (mode) {
            case 'train': IconComponent = Train; color = '#F6891F'; break;
            case 'metro': IconComponent = Train; color = '#009699'; break;
            case 'bus': IconComponent = Bus; color = '#00B5EF'; break;
            case 'lightrail': IconComponent = TramFront; color = '#E6002B'; break;
            case 'ferry': IconComponent = Ship; color = '#5BB543'; break;
            default: IconComponent = Bus; color = '#333';
        }

        const iconMarkup = renderToStaticMarkup(
            <div style={{
                background: 'white',
                borderRadius: '50%',
                border: `3px solid ${color}`,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
                <IconComponent size={18} color={color} fill={color} style={{ fillOpacity: 0.2 }} />
            </div>
        );

        return divIcon({
            html: iconMarkup,
            className: 'custom-marker-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Map */}
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer
                    center={defaultCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {vehicles.map(v => (
                        v.vehicle && v.vehicle.position && (
                            <Marker
                                key={v.id}
                                position={[v.vehicle.position.latitude, v.vehicle.position.longitude]}
                                icon={getIcon(v.mode)}
                            >
                                <Popup>
                                    <div style={{ minWidth: 150 }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                            {v.vehicle.vehicle?.label || v.id}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#666' }}>
                                            Route: {v.vehicle.trip?.routeId || 'Unknown'}
                                            <br />
                                            Trip: {v.vehicle.trip?.tripId}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    ))}
                </MapContainer>

                {/* Loading Indicator Overlay (only initial load) */}
                {loading && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                        background: 'rgba(255,255,255,0.9)',
                        padding: '12px 24px',
                        borderRadius: 24,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 500,
                        color: 'var(--text-primary)'
                    }}>
                        <div style={{
                            width: 16,
                            height: 16,
                            border: '2px solid #ccc',
                            borderTop: '2px solid var(--primary-color)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        Loading live traffic...
                    </div>
                )}


                {/* Info overlay */}
                <div style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    background: 'rgba(26, 26, 26, 0.95)',
                    padding: '12px 16px',
                    borderRadius: 8,
                    zIndex: 1000,
                    fontSize: 14,
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ color: 'white', fontWeight: 'bold', marginBottom: 4 }}>Live Tracking Active</div>
                    Active: {Object.entries(filters).filter(([_, v]) => v).map(([k]) => k).join(', ')}
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                        Updates every 15s • {vehicles.length} vehicles found
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .leaflet-container {
          background: #e0e0e0;
        }
      `}</style>
        </div>
    );
};

export default LiveMap;
