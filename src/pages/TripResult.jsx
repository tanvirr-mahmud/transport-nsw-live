import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, AlertCircle } from 'lucide-react';
import { getTrips } from '../services/api';
import TripResultCard from '../components/TripResultCard';

const TripResult = () => {
    const { originId, destinationId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const originName = searchParams.get('originName') || 'Origin';
    const destName = searchParams.get('destName') || 'Destination';

    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTripsData = async () => {
            try {
                const data = await getTrips(originId, destinationId);
                setTrips(data);
            } catch (err) {
                console.error(err);
                setError(err.message || 'Failed to load trips');
            } finally {
                setLoading(false);
            }
        };

        fetchTripsData();

        // Auto-refresh every 30 seconds for real-time vibe
        const interval = setInterval(fetchTripsData, 30000);
        return () => clearInterval(interval);
    }, [originId, destinationId]);

    const formatTime = (isoString) => {
        if (!isoString) return '--:--';
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getDelay = (planned, estimated) => {
        if (!estimated) return 'On Time';
        const p = new Date(planned);
        const e = new Date(estimated);
        const diffMins = Math.round((e - p) / 60000);
        if (diffMins <= 0) return 'On Time';
        return `+${diffMins} min Late`;
    };

    const getDelayColor = (delayText) => {
        if (delayText === 'On Time') return 'var(--success-color)';
        return 'var(--danger-color)';
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 0', borderBottom: '1px solid #333', marginBottom: 20 }}>
                <div
                    onClick={() => navigate(-1)}
                    style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--primary-color)', marginBottom: 12 }}>
                    <ArrowLeft size={18} style={{ marginRight: 6 }} /> Back
                </div>
                <h2 style={{ margin: '0 0 4px 0' }}>{originName}</h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>to</div>
                <h2 style={{ margin: 0 }}>{destName}</h2>
            </div>

            {loading && !trips.length && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading trips...</div>}

            {error && (
                <div style={{ padding: 16, background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger-color)', borderRadius: 12, display: 'flex', alignItems: 'center' }}>
                    <AlertCircle size={20} style={{ marginRight: 12 }} />
                    {error}
                </div>
            )}

            <div style={{ flex: 1 }}>
                {trips.length === 0 && !loading && !error && (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 40 }}>
                        No trips found for this route currently.
                    </div>
                )}

                {trips.map((journey, index) => (
                    <TripResultCard key={index} journey={journey} />
                ))}
            </div>
        </div>
    );
};

export default TripResult;
