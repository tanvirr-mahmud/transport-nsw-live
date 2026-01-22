import React from 'react';
import { Outlet } from 'react-router-dom';
const SplitLayout = () => {
    return (
        <div style={{ minHeight: '100vh', paddingBottom: 70 }}>
            <Outlet />
        </div>
    );
};

export default SplitLayout;
