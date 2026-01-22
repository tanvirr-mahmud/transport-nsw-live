import React, { useState, useEffect, useMemo } from 'react';
import TripPlannerInput from '../components/TripPlannerInput';
import TripResultCard from '../components/TripResultCard';
import TrainLocationModal from '../components/TrainLocationModal';
import { getTrips } from '../services/api';
import { Clock } from 'lucide-react';

const Home = () => {
    // Current time for the header
    const [currentTime, setCurrentTime] = useState(new Date());
    const [rawTrips, setRawTrips] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searched, setSearched] = useState(false);
    const [timeFormat, setTimeFormat] = useState('24h'); // Default to 24h
    const [weather, setWeather] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(true);

    const [preference, setPreference] = useState('all_stops');
    const [selectedJourney, setSelectedJourney] = useState(null);
    const [favorites, setFavorites] = useState(() => {
        const saved = localStorage.getItem('favorite_trips');
        return saved ? JSON.parse(saved) : [];
    });

    const getPrimaryLegs = (journey) => {
        if (!journey?.legs) return [];
        return journey.legs.filter((leg) => {
            const productClass = leg?.transportation?.product?.class;
            if (productClass === undefined || productClass === null) return false;
            return productClass !== 100 && productClass !== 99;
        });
    };

    const getRealtimeTripId = (journey) => {
        const primaryLegs = getPrimaryLegs(journey);
        if (primaryLegs.length === 0) return null;
        return primaryLegs[0]?.transportation?.properties?.RealtimeTripId
            || primaryLegs[0]?.transportation?.tripCode
            || primaryLegs[0]?.transportation?.id
            || null;
    };

    const getDepartureTime = (trip) => {
        const depTime = trip?.legs?.[0]?.origin?.departureTimeEstimated || trip?.legs?.[0]?.origin?.departureTimePlanned;
        if (!depTime) return null;
        const date = new Date(depTime);
        if (Number.isNaN(date.getTime())) return null;
        return date;
    };

    const getArrivalTime = (journey) => {
        if (!journey?.legs?.length) return null;
        const last = journey.legs[journey.legs.length - 1];
        const arrTime = last?.destination?.arrivalTimeEstimated || last?.destination?.arrivalTimePlanned;
        if (!arrTime) return null;
        const arr = new Date(arrTime);
        if (Number.isNaN(arr.getTime())) return null;
        return arr;
    };

    const getDuration = (journey) => {
        if (!journey?.legs?.length) return 999999999;
        const dep = getDepartureTime(journey);
        const arr = getArrivalTime(journey);
        if (!dep || !arr) return 999999999;
        return arr - dep;
    };

    const getStopCount = (journey) => {
        // Count intermediate stops in the primary transport leg's stopSequence
        const primaryLegs = getPrimaryLegs(journey);
        if (primaryLegs.length === 0) return 0;

        // For direct trips, count stops in the first leg
        const firstLeg = primaryLegs[0];
        const stopSequence = firstLeg?.stopSequence || [];

        // stopSequence includes origin and destination, so intermediate stops = length - 2
        return Math.max(0, stopSequence.length - 2);
    };

    const isLimitedStops = (journey) => {
        // A limited stops service typically has fewer intermediate stops than all stops
        // We'll consider it limited stops if it has 5 or fewer intermediate stops
        // This is a heuristic - adjust based on typical route characteristics
        const stopCount = getStopCount(journey);
        return stopCount <= 5;
    };

    const deduplicateTrips = (rawTrips) => {
        // Only remove truly identical journeys (same departure, arrival, route, and transfers)
        const seen = new Set();
        const result = [];

        rawTrips.forEach(trip => {
            const dep = getDepartureTime(trip);
            const arr = getArrivalTime(trip);
            if (!dep) return;

            const primaryLegs = getPrimaryLegs(trip);
            const routeSignature = primaryLegs.map(leg => {
                const line = leg?.transportation?.disassembledName || leg?.transportation?.name || '';
                const dest = leg?.destination?.name || '';
                return `${line}-${dest}`;
            }).join('|');

            const key = `${dep.toISOString()}-${arr ? arr.toISOString() : 'unknown'}-${routeSignature}-${primaryLegs.length}`;

            if (!seen.has(key)) {
                seen.add(key);
                result.push(trip);
            }
        });

        return result;
    };

    const selectBestJourneyPerTrain = (trips) => {
        const grouped = {};

        trips.forEach(journey => {
            const tripId = getRealtimeTripId(journey) || (getDepartureTime(journey)?.toISOString() || Math.random().toString());
            if (!grouped[tripId]) {
                grouped[tripId] = [];
            }
            grouped[tripId].push(journey);
        });

        const result = [];
        Object.values(grouped).forEach(group => {
            if (group.length === 1) {
                result.push(group[0]);
                return;
            }

            const directOptions = group.filter(journey => getPrimaryLegs(journey).length <= 1);
            if (directOptions.length > 0) {
                directOptions.sort((a, b) => {
                    const arrA = getArrivalTime(a);
                    const arrB = getArrivalTime(b);
                    if (!arrA || !arrB) return 0;
                    return arrA - arrB;
                });
                result.push(directOptions[0]);
                return;
            }

            const sortedByTransfers = [...group].sort((a, b) => {
                const legsA = getPrimaryLegs(a).length;
                const legsB = getPrimaryLegs(b).length;
                if (legsA !== legsB) return legsA - legsB;
                const arrA = getArrivalTime(a);
                const arrB = getArrivalTime(b);
                if (!arrA || !arrB) return 0;
                return arrA - arrB;
            });

            result.push(sortedByTransfers[0]);
        });

        return result;
    };

    const sortTrips = (tripsList, pref) => {
        let sorted = [...tripsList];

        if (pref === 'fastest') {
            if (sorted.length === 0) return [];

            const now = new Date();
            sorted = sorted.filter(t => {
                const dep = getDepartureTime(t);
                return dep && dep >= now;
            });

            if (sorted.length === 0) return [];

            const arrivals = sorted
                .map(t => getArrivalTime(t))
                .filter(Boolean);

            if (arrivals.length === 0) return [];

            const minArrival = Math.min(...arrivals.map(d => d.getTime()));
            const threshold = minArrival + (5 * 60 * 1000); // Allow trips arriving within +5 min of the earliest

            sorted = sorted.filter(t => {
                const arr = getArrivalTime(t);
                return arr && arr.getTime() <= threshold;
            });

            sorted.sort((a, b) => {
                const arrA = getArrivalTime(a);
                const arrB = getArrivalTime(b);
                if (!arrA && !arrB) return 0;
                if (!arrA) return 1;
                if (!arrB) return -1;
                return arrA - arrB;
            });
        } else if (pref === 'limited_stops') {
            if (sorted.length === 0) return [];

            // Filter to only limited stops services (services with fewer intermediate stops)
            const limitedStopsTrips = sorted.filter(t => isLimitedStops(t));

            // If we have limited stops trips, use those; otherwise fall back to duration-based filtering
            if (limitedStopsTrips.length > 0) {
                sorted = limitedStopsTrips;
            } else {
                // Fallback: filter by duration (faster trips are more likely to be limited stops)
                const durations = sorted.map(t => getDuration(t));
                const minDuration = Math.min(...durations);
                const threshold = minDuration * 1.20; // 20% tolerance
                sorted = sorted.filter(t => getDuration(t) <= threshold);
            }

            sorted.sort((a, b) => {
                const depA = getDepartureTime(a);
                const depB = getDepartureTime(b);
                if (!depA || !depB) return 0;
                return depA - depB;
            });
        } else {
            sorted.sort((a, b) => {
                const depA = getDepartureTime(a);
                const depB = getDepartureTime(b);
                if (!depA || !depB) return 0;
                return depA - depB;
            });
        }
        return sorted;
    };

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        localStorage.setItem('favorite_trips', JSON.stringify(favorites));
    }, [favorites]);

    const saveFavorite = (fromStation, toStation) => {
        if (!fromStation || !toStation) return;
        const id = `${fromStation.id}-${toStation.id}`;
        setFavorites(prev => {
            if (prev.some(item => item.id === id)) return prev;
            return [
                ...prev,
                {
                    id,
                    from: {
                        id: fromStation.id,
                        name: fromStation.disassembledName || fromStation.name
                    },
                    to: {
                        id: toStation.id,
                        name: toStation.disassembledName || toStation.name
                    }
                }
            ];
        });
    };

    const removeFavorite = (favoriteId) => {
        setFavorites(prev => prev.filter(item => item.id !== favoriteId));
    };

    // Re-sort current trips whenever preference changes
    // Derived state for trips: Deduped (already done on fetch) -> Sorted/Filtered
    const trips = useMemo(() => {
        if (!rawTrips.length) return [];
        return sortTrips(rawTrips, preference);
    }, [rawTrips, preference]);


    // Format time based on timeFormat preference
    const formattedTime = timeFormat === '24h'
        ? currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

    const handlePlanTrip = async (origin, destination) => {
        setLoading(true);
        setError(null);
        setSearched(true);
        try {
            // Fetch trips across multiple time windows to match official app coverage
            const now = new Date();
            const timeWindows = [];

            // Past trips: every 2 hours for last 6 hours
            for (let i = 6; i >= 0; i -= 2) {
                timeWindows.push(new Date(now.getTime() - i * 60 * 60 * 1000));
            }

            // Current time
            timeWindows.push(now);

            // Future trips: every 30 minutes for next 2 hours, then every 2 hours for next 4 hours
            for (let i = 30; i <= 120; i += 30) {
                timeWindows.push(new Date(now.getTime() + i * 60 * 1000));
            }
            for (let i = 3; i <= 6; i += 2) {
                timeWindows.push(new Date(now.getTime() + i * 60 * 60 * 1000));
            }


            // Fetch in smaller batches with error handling to avoid overwhelming the API
            const batchSize = 3;
            const allTrips = [];
            let errors = [];

            for (let i = 0; i < timeWindows.length; i += batchSize) {
                const batch = timeWindows.slice(i, i + batchSize);
                const batchResults = await Promise.allSettled(
                    batch.map(time => getTrips(origin.id, destination.id, time, { count: 150 }).catch(err => {
                        return [];
                    }))
                );

                batchResults.forEach((result, idx) => {
                    if (result.status === 'fulfilled') {
                        allTrips.push(...result.value);
                    } else {
                        errors.push(`Time window ${i + idx}: ${result.reason?.message || 'Unknown error'}`);
                    }
                });

                // Small delay between batches to avoid rate limiting
                if (i + batchSize < timeWindows.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }


            let data = allTrips;

            // Fallback: if we got no results, try a simpler approach with just current time
            if (data.length === 0) {
                try {
                    const simpleData = await getTrips(origin.id, destination.id, now, { count: 300 });
                    if (simpleData.length > 0) {
                        data = simpleData;
                    }
                } catch (fallbackErr) {
                    console.error('Fallback also failed:', fallbackErr);
                }
            }

            if (data.length === 0) {
                throw new Error('No trips found. Please check your origin and destination stations.');
            }

            // Deduplicate only truly identical journeys
            const uniqueTrips = deduplicateTrips(data);

            // Sort by departure time (show all unique trips, not just one per train)
            const sortedByTime = [...uniqueTrips].sort((a, b) => {
                const depA = getDepartureTime(a);
                const depB = getDepartureTime(b);
                if (!depA && !depB) return 0;
                if (!depA) return 1;
                if (!depB) return -1;
                return depA - depB;
            });

            // Show the full sorted list (closer to official app behavior)
            const filteredTrips = sortedByTime.filter(trip => getDepartureTime(trip));


            // Set raw trips, the useMemo will handle sorting according to preference
            setRawTrips(filteredTrips);
        } catch (err) {
            console.error('Trip planning error:', err);
            const errorMessage = err.message || "Failed to find trips. Please try again.";
            setError(errorMessage);
            setRawTrips([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch weather data (Sydney coordinates)
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // Using OpenWeatherMap API (free tier)
                // You can get a free API key from https://openweathermap.org/api
                const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
                if (!apiKey) {
                    console.warn('OpenWeatherMap API key not found. Weather data will not be available.');
                    setWeatherLoading(false);
                    return;
                }

                // Sydney coordinates
                const lat = -33.8688;
                const lon = 151.2093;

                // Fetch current weather
                const weatherResponse = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
                );

                // Fetch UV index from One Call API (includes UV index)
                let uvIndex = null;
                try {
                    const uvResponse = await fetch(
                        `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&units=metric&appid=${apiKey}`
                    );
                    if (uvResponse.ok) {
                        const uvData = await uvResponse.json();
                        uvIndex = Math.round(uvData.current?.uvi || 0);
                    }
                } catch (uvErr) {
                    console.warn('UV index not available:', uvErr);
                }

                if (weatherResponse.ok) {
                    const data = await weatherResponse.json();
                    setWeather({
                        temperature: Math.round(data.main.temp),
                        condition: data.weather[0].main,
                        icon: data.weather[0].icon,
                        uvIndex: uvIndex,
                        humidity: data.main.humidity
                    });
                } else {
                    console.warn('Failed to fetch weather data');
                }
            } catch (err) {
                console.error('Error fetching weather:', err);
            } finally {
                setWeatherLoading(false);
            }
        };

        fetchWeather();
        // Refresh weather every 30 minutes
        const weatherInterval = setInterval(fetchWeather, 30 * 60 * 1000);
        return () => clearInterval(weatherInterval);
    }, []);

    // Auto-scroll to first upcoming trip
    useEffect(() => {
        if (!loading && trips.length > 0 && searched) {
            const now = new Date();
            const upcomingIndex = trips.findIndex(t => {
                const dep = getDepartureTime(t);
                return dep && dep >= now;
            });

            if (upcomingIndex !== -1) {
                // Wait for render
                setTimeout(() => {
                    const element = document.getElementById(`trip-card-${upcomingIndex}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        }
    }, [trips, loading, searched]);


    return (
        <div style={{ minHeight: '100vh', paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>
            {/* Header with Glass Effect */}
            <div style={{
                padding: '24px 16px 12px 16px',
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {formattedDate}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h1 style={{ fontSize: 32, margin: '4px 0', fontWeight: 700, color: 'white' }}>Trip Planner</h1>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--primary-color)' }}>
                            {formattedTime}
                        </div>
                        {weather && !weatherLoading && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontSize: 11, color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {weather.icon && (
                                        <img
                                            src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                                            alt={weather.condition}
                                            style={{ width: 20, height: 20 }}
                                        />
                                    )}
                                    <span>{weather.temperature}°C</span>
                                </div>
                                {weather.uvIndex !== null && (
                                    <div style={{ fontSize: 10, color: weather.uvIndex > 7 ? '#ff6b6b' : weather.uvIndex > 5 ? '#ffa500' : '#51cf66' }}>
                                        UV {weather.uvIndex}
                                    </div>
                                )}
                            </div>
                        )}
                        {weatherLoading && (
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                Loading...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Input Form */}
            <TripPlannerInput
                onPlanTrip={handlePlanTrip}
                selectedPreference={preference}
                onPreferenceChange={setPreference}
                favorites={favorites}
                onSaveFavorite={saveFavorite}
                onRemoveFavorite={removeFavorite}
            />

            {/* Content Area */}
            <div style={{ flex: 1, padding: '16px', background: searched ? 'transparent' : 'transparent' }}>

                {loading && (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                        Searching...
                    </div>
                )}

                {error && (
                    <div style={{ padding: 12, background: 'rgba(255, 69, 58, 0.1)', color: 'var(--danger-color)', borderRadius: 8, marginBottom: 16 }}>
                        {error}
                    </div>
                )}

                {/* Results List */}
                {searched && !loading && trips.length > 0 && (
                    <div>
                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: 18, color: 'white', fontWeight: 600 }}>Suggested Trips</h3>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {/* Time Format Toggle */}
                                <div style={{ background: 'var(--surface-color)', borderRadius: 16, padding: 4, display: 'flex' }}>
                                    <button
                                        onClick={() => setTimeFormat('12h')}
                                        style={{
                                            border: 'none', background: timeFormat === '12h' ? 'var(--text-primary)' : 'transparent',
                                            color: timeFormat === '12h' ? 'var(--bg-color)' : 'var(--text-secondary)',
                                            borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >12h</button>
                                    <button
                                        onClick={() => setTimeFormat('24h')}
                                        style={{
                                            border: 'none', background: timeFormat === '24h' ? 'var(--text-primary)' : 'transparent',
                                            color: timeFormat === '24h' ? 'var(--bg-color)' : 'var(--text-secondary)',
                                            borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >24h</button>
                                </div>
                            </div>
                        </div>
                        {trips.map((journey, index) => (
                            <div key={index} id={`trip-card-${index}`}>
                                <TripResultCard
                                    journey={journey}
                                    timeFormat={timeFormat}
                                    onTripClick={setSelectedJourney}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {searched && !loading && !error && trips.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 40 }}>
                        No trips found.
                    </div>
                )}

                {/* Initial State / Recent */}
                {!searched && !loading && (
                    <div style={{ marginTop: 0 }}>
                        <h3 style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 12 }}>Recent</h3>
                        <div style={{
                            padding: 16,
                            background: 'var(--surface-color)',
                            borderRadius: 12,
                            display: 'flex', alignItems: 'center',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic'
                        }}>
                            <Clock size={16} style={{ marginRight: 8 }} />
                            No recent trips
                        </div>
                    </div>
                )}
            </div>

            {/* Train Location Modal */}
            {selectedJourney && (
                <TrainLocationModal
                    journey={selectedJourney}
                    onClose={() => setSelectedJourney(null)}
                />
            )}
        </div>
    );
};

export default Home;
