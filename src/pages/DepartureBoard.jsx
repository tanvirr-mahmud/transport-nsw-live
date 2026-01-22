import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Train, Bus, TramFront, Ship } from 'lucide-react';
import { getDepartures } from '../services/api';

import { useFilters } from '../context/FilterContext';

const DepartureBoard = () => {
    const { stopId } = useParams();
    const navigate = useNavigate();
    const { filters, formatTime: formatTimeWithContext } = useFilters();
    const [departures, setDepartures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [stopName, setStopName] = useState('Stop');

    const fetchDepartures = async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const data = await getDepartures(stopId);
            setDepartures(data);

            // Extract stop name from first departure if available
            if (data.length > 0 && data[0].location) {
                setStopName(data[0].location.name || 'Stop');
            }
        } catch (err) {
            console.error(err);
            setError('Failed to load departures');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDepartures();

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => fetchDepartures(true), 30000);
        return () => clearInterval(interval);
    }, [stopId]);

    const handleRefresh = () => {
        fetchDepartures(true);
    };

    const getTimeColor = (departure) => {
        // Check if delayed
        if (departure.departureTimeEstimated && departure.departureTimePlanned) {
            const estimated = new Date(departure.departureTimeEstimated);
            const planned = new Date(departure.departureTimePlanned);
            const delayMinutes = (estimated - planned) / 60000;

            if (delayMinutes > 2) return 'var(--danger-color)'; // Red for late
            if (delayMinutes < -1) return 'var(--success-color)'; // Green for early/on-time
        }

        return 'var(--success-color)'; // Default green for on-time
    };

    const formatTime = (isoString) => {
        return formatTimeWithContext(isoString);
    };

    const getTransportIcon = (product) => {
        const productClass = product?.class || 1;
        switch (productClass) {
            case 1: return <Train size={20} />;
            case 5: return <Bus size={20} />;
            case 4: return <TramFront size={20} />;
            case 9: return <Ship size={20} />;
            default: return <Train size={20} />;
        }
    };

    const getPlatform = (departure) => {
        // 1. Try explicit platform property (some endpoints)
        if (departure.platform) return departure.platform;

        // 2. Try plannedPlatform (common in TripPlanner)
        if (departure.plannedPlatform) return departure.plannedPlatform;

        // 3. Try properties object
        if (departure.properties?.platform) return departure.properties.platform;
        if (departure.properties?.Platform) return departure.properties.Platform;

        // 4. Try parsing location name (e.g. "Auburn Station, Platform 4")
        const locationName = departure.location?.name || '';
        const match = locationName.match(/Platform\s+([0-9A-Za-z]+)/i);
        if (match) return match[1];

        return null;
    };

    // Pull-to-refresh handler
    const handleTouchStart = (e) => {
        const startY = e.touches[0].clientY;
        const handleTouchMove = (moveEvent) => {
            const currentY = moveEvent.touches[0].clientY;
            if (currentY - startY > 100 && window.scrollY === 0) {
                handleRefresh();
                document.removeEventListener('touchmove', handleTouchMove);
            }
        };
        document.addEventListener('touchmove', handleTouchMove);
        document.addEventListener('touchend', () => {
            document.removeEventListener('touchmove', handleTouchMove);
        }, { once: true });
    };

    return (
        <div onTouchStart={handleTouchStart} style={{ minHeight: '100vh', paddingBottom: 80 }}>
            {/* Header */}
            <div style={{
                position: 'sticky',
                top: 0,
                background: 'var(--bg-color)',
                zIndex: 100,
                padding: '20px 16px',
                borderBottom: '1px solid #333'
            }}>
                <div onClick={() => navigate(-1)} style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: 'var(--primary-color)',
                    marginBottom: 12
                }}>
                    <ArrowLeft size={18} style={{ marginRight: 6 }} /> Back
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: 24 }}>{stopName}</h2>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary-color)',
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            padding: 8
                        }}
                    >
                        <RefreshCw size={20} style={{
                            animation: refreshing ? 'spin 1s linear infinite' : 'none'
                        }} />
                    </button>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Live Departures
                </div>
            </div>

            {/* Loading Indicator */}
            {loading && !refreshing && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '60vh'
                }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        border: '4px solid var(--surface-color)',
                        borderTop: '4px solid var(--primary-color)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div style={{
                    margin: 16,
                    padding: 16,
                    background: 'rgba(255, 69, 58, 0.1)',
                    color: 'var(--danger-color)',
                    borderRadius: 12
                }}>
                    {error}
                </div>
            )}

            {/* Departures List */}
            {!loading && !error && (
                <div style={{ padding: 16 }}>
                    {departures.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            color: 'var(--text-secondary)',
                            marginTop: 40
                        }}>
                            No departures found
                        </div>
                    ) : (
                        departures
                            .filter(departure => {
                                const productClass = departure.transportation?.product?.class || 1;
                                // Map product class to filter keys
                                if (productClass === 1) return filters.train || filters.metro;
                                if (productClass === 5) return filters.bus;
                                if (productClass === 4) return filters.lightrail;
                                if (productClass === 9) return filters.ferry;
                                return true;
                            })
                            .map((departure, index) => {
                                const timeColor = getTimeColor(departure);
                                const departureTime = departure.departureTimeEstimated || departure.departureTimePlanned;
                                const platform = getPlatform(departure);

                                return (
                                    <div
                                        key={index}
                                        style={{
                                            background: 'var(--surface-color)',
                                            borderRadius: 12,
                                            padding: 16,
                                            marginBottom: 12
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                                    <div style={{ color: 'var(--text-secondary)', marginRight: 8 }}>
                                                        {getTransportIcon(departure.transportation?.product)}
                                                    </div>
                                                    <div style={{
                                                        fontSize: 18,
                                                        fontWeight: 700,
                                                        color: 'white'
                                                    }}>
                                                        {departure.transportation?.destination?.name || 'Unknown Destination'}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    {departure.transportation?.description || departure.transportation?.number || ''}
                                                </div>
                                                {platform && (
                                                    <div style={{
                                                        fontSize: 13,
                                                        color: 'var(--text-secondary)',
                                                        marginTop: 4,
                                                        fontWeight: 500
                                                    }}>
                                                        Platform {platform}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{
                                                fontSize: 24, // Slightly smaller to fit date if needed
                                                fontWeight: 700,
                                                color: timeColor,
                                                textAlign: 'right',
                                                whiteSpace: 'pre-wrap', // Allow wrapping for date
                                                maxWidth: 120
                                            }}>
                                                {formatTime(departureTime)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                    )}
                </div>
            )}

            <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default DepartureBoard;
