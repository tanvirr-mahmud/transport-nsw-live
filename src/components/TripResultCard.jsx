import React from 'react';

const TripResultCard = ({ journey, timeFormat = '24h', onTripClick }) => {
    if (!journey || !journey.legs || journey.legs.length === 0) return null;

    // Helper to get time object
    const getTime = (isoString) => (isoString ? new Date(isoString) : null);

    const extractPlatform = (stopInfo) => {
        if (!stopInfo) return null;
        const directField = stopInfo.platform || stopInfo.platformName || stopInfo.platformLongName;
        if (directField) {
            return String(directField).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        }
        const match = stopInfo.name?.match(/(?:Platform|Plat)\s+([A-Za-z0-9]+)/i);
        return match ? match[1].toUpperCase() : null;
    };

    const cleanStopName = (stopInfo) => {
        if (!stopInfo?.name) return 'Interchange';
        return stopInfo.name
            .split(',')[0]
            .replace(/Platform\s+\w+/i, '')
            .trim() || 'Interchange';
    };

    const getLineCode = (lineName = '') => {
        const lineCodeMatch = lineName.match(/([A-Z0-9]+)(\s|$)/);
        let lineCodeLocal = lineCodeMatch ? lineCodeMatch[1] : lineName.substring(0, 3);
        if (lineName.includes('T1')) lineCodeLocal = 'T1';
        if (lineName.includes('T2')) lineCodeLocal = 'T2';
        if (lineName.includes('T3')) lineCodeLocal = 'T3';
        if (lineName.includes('T4')) lineCodeLocal = 'T4';
        if (lineName.includes('T8')) lineCodeLocal = 'T8';
        if (lineName.includes('T9')) lineCodeLocal = 'T9';
        if (lineName.includes('SCO')) lineCodeLocal = 'SCO';
        if (lineName.includes('CCN')) lineCodeLocal = 'CCN';
        if (lineName.includes('BMT')) lineCodeLocal = 'BMT';
        return lineCodeLocal;
    };

    // Find the main transport leg (longest or first non-walk)
    const transportLegs = journey.legs.filter((leg) => {
        const productClass = leg?.transportation?.product?.class;
        if (productClass === undefined || productClass === null) return false;
        return productClass !== 100 && productClass !== 99;
    });
    const mainLeg = transportLegs.length > 0 ? transportLegs[0] : journey.legs[0];
    const requiresChange = transportLegs.length > 1;
    const changeCount = requiresChange ? transportLegs.length - 1 : 0;

    // Origin/Dest of the whole journey
    const origin = journey.legs[0]?.origin;
    const destination = journey.legs[journey.legs.length - 1]?.destination;

    const plannedDep = getTime(origin?.departureTimePlanned);
    const estimatedDep = origin?.departureTimeEstimated ? getTime(origin.departureTimeEstimated) : plannedDep;

    const plannedArr = getTime(destination?.arrivalTimePlanned);
    const estimatedArr = destination?.arrivalTimeEstimated ? getTime(destination.arrivalTimeEstimated) : plannedArr;

    // Status / Real-time calculation
    const now = new Date();
    const diffMs = estimatedDep ? estimatedDep - now : 0;
    const diffMins = estimatedDep ? Math.floor(diffMs / 60000) : 0;

    const formatMinutes = (mins) => {
        if (mins < 60) return { value: String(mins), suffix: 'min' };
        const hours = Math.floor(mins / 60);
        const remaining = mins % 60;
        if (remaining === 0) {
            return { value: `${hours}`, suffix: hours === 1 ? 'hr' : 'hrs' };
        }
        return {
            value: `${hours} ${hours === 1 ? 'hr' : 'hrs'} ${remaining}`,
            suffix: remaining === 1 ? 'min' : 'mins'
        };
    };

    let statusColor = '#4cd964'; // Green for on time/future
    let statusLabelTop = 'Leaving';
    let statusValue = diffMins;
    let statusLabelBottom = 'min';

    if (diffMins < 0) {
        statusColor = '#ff3b30'; // Red for Left
        const { value, suffix } = formatMinutes(Math.abs(diffMins));
        statusLabelTop = 'Left';
        statusValue = value;
        statusLabelBottom = `${suffix} ago`;
    } else if (diffMins === 0) {
        statusLabelTop = 'Leaving';
        statusValue = 'Now';
        statusLabelBottom = '';
    } else {
        const { value, suffix } = formatMinutes(diffMins);
        statusValue = value;
        statusLabelBottom = suffix;
    }

    // Line Info
    const lineName = mainLeg?.transportation?.disassembledName || mainLeg?.transportation?.name || '';
    // Extract short code like "T1", "T4", "B1"
    let lineCode = getLineCode(lineName);

    // Line Color (Mock logic)
    const mode = mainLeg?.transportation?.product?.class;
    let lineColor = '#FFB81C'; // Default T-set yellow/orange
    if (mode === 1) lineColor = '#F6931E'; // Train 
    if (mode === 5 || mode === 7) lineColor = '#00B5EF'; // Bus
    if (mode === 4) lineColor = '#E1251B'; // Light Rail
    if (mode === 9) lineColor = '#57AD2B'; // Ferry
    if (requiresChange) lineColor = '#FF9500'; // Highlight multi-leg journeys

    // Platform Info
    const platformMatch = origin?.name?.match(/(?:Platform|Plat)\s+(\d+)/i);
    const platformNum = platformMatch ? platformMatch[1] : null;

    const changeSteps = requiresChange
        ? transportLegs.slice(0, -1).map((leg, index) => {
            const nextLeg = transportLegs[index + 1];
            const dropPlatform = extractPlatform(leg.destination);
            const boardPlatform = extractPlatform(nextLeg.origin);
            return {
                interchange: cleanStopName(leg.destination),
                dropPlatform,
                boardPlatform,
                nextService: nextLeg.transportation?.disassembledName || nextLeg.transportation?.name || 'Next service',
                nextServiceCode: getLineCode(nextLeg.transportation?.disassembledName || nextLeg.transportation?.name || '')
            };
        })
        : [];

    // Format Time Range
    const formatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: timeFormat === '12h'
    };
    const timeString = estimatedDep && estimatedArr
        ? `${estimatedDep.toLocaleTimeString([], formatOptions)} - ${estimatedArr.toLocaleTimeString([], formatOptions)}`
        : '--:-- - --:--';

    // Duration
    const durationMs = estimatedArr && estimatedDep ? (estimatedArr - estimatedDep) : 0;
    const durationMins = estimatedArr && estimatedDep ? Math.floor(durationMs / 60000) : 0;

    // Destination
    const destName = mainLeg?.destination?.name?.split(',')[0] || destination?.name?.split(',')[0] || 'Destination';

    // Calculate progress for the progress bar (0-100%)
    // Progress based on time until departure
    const getProgress = () => {
        if (!estimatedDep) return 0;
        const now = new Date();
        const totalDuration = durationMins * 60 * 1000; // Total trip duration in ms
        const timeUntilDeparture = estimatedDep - now;

        // If trip has left, show 100% progress
        if (timeUntilDeparture < 0) return 100;

        // Show progress based on how close to departure (0-50% before departure, 50-100% during trip)
        // For simplicity, show progress based on time until departure
        const maxWaitTime = 60 * 60 * 1000; // 1 hour max wait
        const progress = Math.max(0, Math.min(50, 50 - (timeUntilDeparture / maxWaitTime) * 50));
        return progress;
    };

    const progress = getProgress();

    // Get all train line codes for badges
    const allLineCodes = transportLegs.map(leg => {
        const name = leg?.transportation?.disassembledName || leg?.transportation?.name || '';
        return getLineCode(name);
    }).filter(Boolean);

    // Format departure time for display (respects timeFormat)
    const formatTime = (date) => {
        if (!date) return '--:--';
        const formatOptions = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: timeFormat === '12h'
        };
        return date.toLocaleTimeString([], formatOptions);
    };

    // Get intermediate station name (like "Lidcombe" in the sample)
    const intermediateStation = transportLegs.length > 1
        ? cleanStopName(transportLegs[0]?.destination)
        : destName;

    return (
        <div
            onClick={() => onTripClick && onTripClick(journey)}
            style={{
                background: 'rgba(40, 40, 40, 0.8)',
                borderRadius: 12,
                padding: '16px',
                marginBottom: 12,
                cursor: onTripClick ? 'pointer' : 'default',
                transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
                if (onTripClick) {
                    e.currentTarget.style.background = 'rgba(50, 50, 50, 0.9)';
                }
            }}
            onMouseLeave={(e) => {
                if (onTripClick) {
                    e.currentTarget.style.background = 'rgba(40, 40, 40, 0.8)';
                }
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Left: Large Time */}
                <div style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: 'white',
                    minWidth: 70,
                    textAlign: 'left'
                }}>
                    {formatTime(estimatedDep)}
                </div>

                {/* Center: Progress Bar and Station */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Progress Bar */}
                    <div style={{
                        width: '100%',
                        height: 4,
                        background: 'rgba(255, 149, 0, 0.2)',
                        borderRadius: 2,
                        position: 'relative',
                        overflow: 'visible'
                    }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: '#ff9500',
                            borderRadius: 2,
                            transition: 'width 0.3s ease'
                        }} />
                        {/* Train Icon at the end of progress - Double-Decker Sydney Train */}
                        <div style={{
                            position: 'absolute',
                            left: `${progress}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 32,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                        }}>
                            <svg
                                width="32"
                                height="20"
                                viewBox="0 0 32 20"
                                fill="none"
                                style={{
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                                }}
                            >
                                {/* Main train body - Orange */}
                                <rect x="0" y="2" width="32" height="12" rx="0.5" fill="#ff9500" stroke="#1a1a1a" strokeWidth="0.5" />

                                {/* Grey roof section */}
                                <rect x="0" y="2" width="32" height="3" fill="#666" stroke="#1a1a1a" strokeWidth="0.5" />

                                {/* Grey undercarriage */}
                                <rect x="0" y="12" width="32" height="2" fill="#666" stroke="#1a1a1a" strokeWidth="0.5" />

                                {/* Upper level windows - dark grey */}
                                <rect x="2" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="4.5" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="7" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="9.5" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="12" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="14.5" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="17" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="19.5" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="22" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="24.5" y="3.5" width="1.8" height="2" fill="#333" />
                                <rect x="27" y="3.5" width="1.8" height="2" fill="#333" />

                                {/* Lower level windows and doors */}
                                <rect x="2" y="7" width="1.5" height="3" fill="#333" />
                                <rect x="4" y="7" width="1.5" height="3" fill="#333" />
                                {/* Doors with vertical line */}
                                <rect x="6.5" y="7" width="2.5" height="4.5" fill="white" stroke="#1a1a1a" strokeWidth="0.3" />
                                <line x1="7.75" y1="7" x2="7.75" y2="11.5" stroke="#1a1a1a" strokeWidth="0.3" />
                                <rect x="9.5" y="7" width="1.5" height="3" fill="#333" />
                                <rect x="11.5" y="7" width="1.5" height="3" fill="#333" />
                                <rect x="13.5" y="7" width="1.5" height="3" fill="#333" />
                                {/* Second set of doors */}
                                <rect x="16" y="7" width="2.5" height="4.5" fill="white" stroke="#1a1a1a" strokeWidth="0.3" />
                                <line x1="17.25" y1="7" x2="17.25" y2="11.5" stroke="#1a1a1a" strokeWidth="0.3" />
                                <rect x="19" y="7" width="1.5" height="3" fill="#333" />
                                <rect x="21" y="7" width="1.5" height="3" fill="#333" />
                                <rect x="23" y="7" width="1.5" height="3" fill="#333" />
                                <rect x="25" y="7" width="1.5" height="3" fill="#333" />
                                <rect x="27" y="7" width="1.5" height="3" fill="#333" />

                                {/* Front cabin windows - trapezoidal */}
                                <path d="M0 2 L0 5 L1.5 5.5 L1.5 3.5 Z" fill="#333" />
                                <path d="M0 5 L0 8 L1.5 8.5 L1.5 5.5 Z" fill="#333" />

                                {/* Train wheels/bogies - positioned on the line (y=10 is center of 4px line) */}
                                <circle cx="6" cy="10" r="2.2" fill="#1a1a1a" stroke="#333" strokeWidth="0.3" />
                                <circle cx="6" cy="10" r="1.2" fill="#444" />
                                <circle cx="12" cy="10" r="2.2" fill="#1a1a1a" stroke="#333" strokeWidth="0.3" />
                                <circle cx="12" cy="10" r="1.2" fill="#444" />
                                <circle cx="20" cy="10" r="2.2" fill="#1a1a1a" stroke="#333" strokeWidth="0.3" />
                                <circle cx="20" cy="10" r="1.2" fill="#444" />
                                <circle cx="26" cy="10" r="2.2" fill="#1a1a1a" stroke="#333" strokeWidth="0.3" />
                                <circle cx="26" cy="10" r="1.2" fill="#444" />
                            </svg>
                        </div>
                    </div>

                    {/* Station Name */}
                    <div style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'white',
                        textAlign: 'center'
                    }}>
                        {intermediateStation}
                    </div>

                    {/* Status Text */}
                    <div style={{
                        fontSize: 12,
                        color: '#888',
                        textAlign: 'center'
                    }}>
                        {statusLabelTop} {statusValue} {statusLabelBottom}
                    </div>

                    {/* Additional Info */}
                    <div style={{
                        fontSize: 11,
                        color: '#666',
                        textAlign: 'center',
                        marginTop: 4
                    }}>
                        {requiresChange ? (
                            <span style={{ color: '#ff9500' }}>Need to change</span>
                        ) : (
                            <span style={{ color: '#4cd964' }}>Direct</span>
                        )}
                        {' • '}
                        {durationMins} min
                        {' • '}
                        {timeString}
                        {platformNum && ` • Plat ${platformNum}`}
                    </div>

                    {/* Change Instructions (Always visible for transfer trips) */}
                    {requiresChange && changeSteps.length > 0 && (
                        <div style={{
                            marginTop: 8,
                            padding: 10,
                            background: 'rgba(255, 149, 0, 0.15)',
                            borderRadius: 8,
                            border: '1px solid rgba(255, 149, 0, 0.3)'
                        }}>
                            {changeSteps.map((step, idx) => (
                                <div key={idx} style={{ fontSize: 11, color: '#ffd4a3', lineHeight: 1.6, marginBottom: idx < changeSteps.length - 1 ? 8 : 0 }}>
                                    <div style={{ fontWeight: 600, color: '#ff9500', marginBottom: 4 }}>
                                        Change at {step.interchange}
                                    </div>
                                    <div>Drop off at Platform {step.dropPlatform || '?'}</div>
                                    <div>Then board {step.nextServiceCode} on Platform {step.boardPlatform || '?'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Train Line Badges */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    alignItems: 'flex-end'
                }}>
                    {allLineCodes.slice(0, 2).map((code, idx) => {
                        const colors = ['#4cd964', '#ff9500']; // Green for first, Orange for second
                        return (
                            <div
                                key={idx}
                                style={{
                                    background: colors[idx] || '#666',
                                    color: 'white',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    minWidth: 32,
                                    textAlign: 'center'
                                }}
                            >
                                {code}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TripResultCard;
