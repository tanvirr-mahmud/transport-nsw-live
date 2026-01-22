import React, { createContext, useContext, useState, useEffect } from 'react';

const FilterContext = createContext();

export const useFilters = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilters must be used within a FilterProvider');
    }
    return context;
};

export const FilterProvider = ({ children }) => {
    // Initial state from localStorage or defaults
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem('transport_filters');
        return saved ? JSON.parse(saved) : {
            train: true, // Includes Metro
            bus: true,
            lightrail: true,
            ferry: true,
            metro: true
        };
    });

    const [preferences, setPreferences] = useState(() => {
        const saved = localStorage.getItem('app_preferences');
        return saved ? JSON.parse(saved) : {
            use24Hour: false,
            showDate: true
        };
    });

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('transport_filters', JSON.stringify(filters));
    }, [filters]);

    useEffect(() => {
        localStorage.setItem('app_preferences', JSON.stringify(preferences));
    }, [preferences]);

    const toggleFilter = (mode) => {
        setFilters(prev => ({
            ...prev,
            [mode]: !prev[mode]
        }));
    };

    const updatePreference = (key, value) => {
        setPreferences(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const formatTime = (dateObj) => {
        if (!dateObj) return '--:--';
        const date = new Date(dateObj);

        const timeOptions = {
            hour: 'numeric',
            minute: '2-digit',
            hour12: !preferences.use24Hour
        };

        let timeString = date.toLocaleTimeString([], timeOptions);

        if (preferences.showDate) {
            const dateString = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            return `${dateString}, ${timeString}`;
        }

        return timeString;
    };

    const value = {
        filters,
        preferences,
        toggleFilter,
        updatePreference,
        formatTime
    };

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    );
};
