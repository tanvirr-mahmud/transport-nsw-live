import React, { useState } from 'react';
import { ArrowUpDown, Train } from 'lucide-react';
import { searchLocations } from '../services/api';

const TripPlannerInput = ({
    onPlanTrip,
    selectedPreference = 'all_stops',
    onPreferenceChange,
    favorites = [],
    onSaveFavorite,
    onRemoveFavorite
}) => {
    const [fromQuery, setFromQuery] = useState('');
    const [toQuery, setToQuery] = useState('');
    const [fromStation, setFromStation] = useState(null);
    const [toStation, setToStation] = useState(null);
    const [suggestions, setSuggestions] = useState({ type: null, data: [] }); // type: 'from' | 'to'

    const handleSearch = async (query, type) => {
        if (type === 'from') {
            setFromQuery(query);
            setFromStation(null); // Clear selection on type
        } else {
            setToQuery(query);
            setToStation(null); // Clear selection on type
        }

        if (query.length > 2) {
            try {
                const results = await searchLocations(query);
                setSuggestions({ type, data: results });
            } catch (err) {
                console.error(err);
            }
        } else {
            setSuggestions({ type: null, data: [] });
        }
    };

    const handleSelect = (station, type) => {
        if (type === 'from') {
            setFromQuery(station.disassembledName || station.name);
            setFromStation(station);
        } else {
            setToQuery(station.disassembledName || station.name);
            setToStation(station);
        }
        setSuggestions({ type: null, data: [] });
    };

    const handleSwap = () => {
        const tempQuery = fromQuery;
        const tempStation = fromStation;

        setFromQuery(toQuery);
        setFromStation(toStation);

        setToQuery(tempQuery);
        setToStation(tempStation);
    };

    const handlePlanClick = () => {
        if (fromStation && toStation && onPlanTrip) {
            onPlanTrip(fromStation, toStation);
        }
    };

    const handleSaveFavorite = () => {
        if (fromStation && toStation && onSaveFavorite) {
            onSaveFavorite(fromStation, toStation);
        }
    };

    const applyFavorite = (favorite) => {
        const from = { id: favorite.from.id, name: favorite.from.name, disassembledName: favorite.from.name };
        const to = { id: favorite.to.id, name: favorite.to.name, disassembledName: favorite.to.name };
        setFromStation(from);
        setToStation(to);
        setFromQuery(favorite.from.name);
        setToQuery(favorite.to.name);
        setSuggestions({ type: null, data: [] });
    };

    return (
        <div style={{ padding: 16 }}>
            {/* Input Container - Redesigned to match sample with Apple liquid glass */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 12,
                padding: '16px',
                position: 'relative',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
                {/* From Station - Radio Button Style */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: 12,
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: 8
                    }}
                    onClick={() => {
                        if (!fromStation) {
                            const input = document.getElementById('from-input');
                            input?.focus();
                        }
                    }}
                >
                    <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: fromStation ? 'none' : '2px solid #666',
                        background: fromStation ? '#4cd964' : 'transparent',
                        marginRight: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        {fromStation && (
                            <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'white'
                            }} />
                        )}
                    </div>
                    <input
                        id="from-input"
                        type="text"
                        placeholder="From"
                        value={fromQuery}
                        onChange={(e) => handleSearch(e.target.value, 'from')}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: 16,
                            padding: 0,
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Connecting Line */}
                <div style={{
                    position: 'absolute',
                    left: 25,
                    top: 44,
                    bottom: 44,
                    width: 2,
                    borderLeft: '2px dotted #666',
                    pointerEvents: 'none'
                }} />

                {/* To Station - Radio Button Style */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: 8
                    }}
                    onClick={() => {
                        if (!toStation) {
                            const input = document.getElementById('to-input');
                            input?.focus();
                        }
                    }}
                >
                    <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: toStation ? 'none' : '2px solid #666',
                        background: toStation ? '#ff9500' : 'transparent',
                        marginRight: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        {toStation && (
                            <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'white'
                            }} />
                        )}
                    </div>
                    <input
                        id="to-input"
                        type="text"
                        placeholder="To"
                        value={toQuery}
                        onChange={(e) => handleSearch(e.target.value, 'to')}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: 16,
                            padding: 0,
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Swap Button */}
                <button
                    onClick={handleSwap}
                    style={{
                        position: 'absolute',
                        right: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                    }}
                >
                    <ArrowUpDown size={20} />
                </button>
            </div>

            {/* Suggestions Overlay */}
            {suggestions.type && suggestions.data.length > 0 && (
                <div style={{
                    position: 'absolute',
                    zIndex: 100,
                    left: 16, right: 16,
                    background: '#222',
                    borderRadius: 8,
                    marginTop: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    border: '1px solid #444',
                    maxHeight: 200,
                    overflowY: 'auto'
                }}>
                    {suggestions.data.map((station) => (
                        <div
                            key={station.id}
                            onClick={() => handleSelect(station, suggestions.type)}
                            style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #333',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center'
                            }}
                        >
                            <Train size={16} style={{ marginRight: 12, color: 'var(--text-secondary)' }} />
                            <div>
                                <div style={{ fontSize: 14 }}>{station.disassembledName}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {station.parent?.name || station.name}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Preference Pills */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, overflowX: 'auto' }}>
                {[
                    { id: 'all_stops', label: 'All Stops', icon: Train },
                    { id: 'limited_stops', label: 'Limited Stops', icon: Train },
                    { id: 'fastest', label: 'Fastest', icon: Train } // Using generic Train for now or Zap if imported
                ].map(mode => {
                    const isActive = selectedPreference === mode.id;
                    const Icon = mode.icon;
                    return (
                        <button
                            key={mode.id}
                            onClick={() => onPreferenceChange && onPreferenceChange(mode.id)}
                            style={{
                                background: isActive ? 'var(--primary-color)' : 'var(--surface-color)',
                                color: isActive ? 'white' : 'var(--text-secondary)', // White text for active
                                border: 'none',
                                borderRadius: 20,
                                padding: '8px 16px',
                                fontSize: 13,
                                fontWeight: 500,
                                display: 'flex', alignItems: 'center', gap: 6,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {mode.id === 'fastest' ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </svg>
                            ) : (
                                <Icon size={16} />
                            )}
                            {mode.label}
                        </button>
                    );
                })}
            </div>

            {/* Favorites - Redesigned to match sample */}
            {favorites.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 13, color: 'white', marginBottom: 12, fontWeight: 500 }}>
                        Favorite routes
                    </div>
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, paddingRight: 8 }}>
                        {favorites.map((favorite, index) => {
                            const colors = ['#4cd964', '#ff9500', '#007aff', '#ff3b30', '#af52de'];
                            const color = colors[index % colors.length];

                            // Get short names for display
                            const fromName = favorite.from.name.split(',')[0].split(' ')[0];
                            const toName = favorite.to.name.split(',')[0].split(' ')[0];

                            return (
                                <button
                                    key={favorite.id}
                                    onClick={() => applyFavorite(favorite)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        backdropFilter: 'blur(20px)',
                                        WebkitBackdropFilter: 'blur(20px)',
                                        borderRadius: 20,
                                        padding: '8px 16px',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        position: 'relative',
                                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                        overflow: 'visible'
                                    }}
                                >
                                    <div style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: color,
                                        flexShrink: 0
                                    }} />
                                    <span>{fromName} - {toName}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveFavorite && onRemoveFavorite(favorite.id);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: -6,
                                            right: -6,
                                            width: 20,
                                            height: 20,
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: 0,
                                            zIndex: 10,
                                            overflow: 'visible'
                                        }}
                                        title="Remove favorite"
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="#ff3b30"
                                            stroke="none"
                                            style={{
                                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                                                display: 'block'
                                            }}
                                        >
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                        </svg>
                                    </button>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Plan Button */}
            <button
                onClick={handlePlanClick}
                disabled={!fromStation || !toStation}
                style={{
                    width: '100%',
                    marginTop: 24,
                    background: (!fromStation || !toStation) ? '#333' : 'white',
                    color: (!fromStation || !toStation) ? '#666' : 'black',
                    border: 'none',
                    padding: 14,
                    borderRadius: 12,
                    fontSize: 16,
                    fontWeight: 'bold',
                    cursor: (!fromStation || !toStation) ? 'not-allowed' : 'pointer'
                }}
            >
                Plan Trip
            </button>

            {/* Save Favorite */}
            <button
                onClick={handleSaveFavorite}
                disabled={!fromStation || !toStation}
                style={{
                    width: '100%',
                    marginTop: 12,
                    background: 'var(--surface-color)',
                    color: (!fromStation || !toStation) ? '#666' : 'white',
                    border: '1px solid #333',
                    padding: 12,
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: (!fromStation || !toStation) ? 'not-allowed' : 'pointer'
                }}
            >
                Save Favorite
            </button>
        </div>
    );
};

export default TripPlannerInput;
