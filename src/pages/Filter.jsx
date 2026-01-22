import React from 'react';
import { useFilters } from '../context/FilterContext';
import { Train, Bus, TramFront, Ship, Clock, Calendar } from 'lucide-react';

const Filter = () => {
    const { filters, toggleFilter, preferences, updatePreference } = useFilters();

    const sections = [
        {
            title: 'Transport Modes',
            items: [
                { id: 'train', label: 'Train & Metro', icon: Train, color: '#F6891F' }, // Orange T1 color
                { id: 'metro', label: 'Metro (Specific)', icon: Train, color: '#009699' }, // Teal M1 color
                { id: 'bus', label: 'Bus', icon: Bus, color: '#00B5EF' },
                { id: 'lightrail', label: 'Light Rail', icon: TramFront, color: '#E6002B' },
                { id: 'ferry', label: 'Ferry', icon: Ship, color: '#5BB543' },
            ]
        },
        {
            title: 'Display Preferences',
            items: [
                {
                    id: 'use24Hour',
                    label: '24-Hour Time',
                    icon: Clock,
                    type: 'preference',
                    value: preferences.use24Hour,
                    action: () => updatePreference('use24Hour', !preferences.use24Hour)
                },
                {
                    id: 'showDate',
                    label: 'Show Date',
                    icon: Calendar,
                    type: 'preference',
                    value: preferences.showDate,
                    action: () => updatePreference('showDate', !preferences.showDate)
                },
            ]
        }
    ];

    return (
        <div style={{ padding: 20, minHeight: '100vh', paddingBottom: 80 }}>
            <h1 style={{ fontSize: 24, marginBottom: 24 }}>Settings & Filters</h1>

            {sections.map((section, idx) => (
                <div key={idx} style={{ marginBottom: 32 }}>
                    <h3 style={{
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        fontSize: 13,
                        letterSpacing: 1,
                        marginBottom: 12
                    }}>
                        {section.title}
                    </h3>
                    <div style={{
                        background: 'var(--surface-color)',
                        borderRadius: 12,
                        overflow: 'hidden'
                    }}>
                        {section.items.map((item, i) => {
                            const isLast = i === section.items.length - 1;
                            const isPreference = item.type === 'preference';
                            const isActive = isPreference ? item.value : filters[item.id];

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => isPreference ? item.action() : toggleFilter(item.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: 16,
                                        borderBottom: isLast ? 'none' : '1px solid #333',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        background: item.color ? `${item.color}33` : '#333',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 16,
                                        color: item.color || 'white'
                                    }}>
                                        <item.icon size={18} />
                                    </div>
                                    <div style={{ flex: 1, fontWeight: 500 }}>
                                        {item.label}
                                    </div>
                                    <div style={{
                                        width: 48,
                                        height: 28,
                                        background: isActive ? 'var(--primary-color)' : '#333',
                                        borderRadius: 14,
                                        position: 'relative',
                                        transition: 'background 0.2s'
                                    }}>
                                        <div style={{
                                            width: 24,
                                            height: 24,
                                            background: 'white',
                                            borderRadius: '50%',
                                            position: 'absolute',
                                            top: 2,
                                            left: isActive ? 22 : 2,
                                            transition: 'left 0.2s',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Filter;
