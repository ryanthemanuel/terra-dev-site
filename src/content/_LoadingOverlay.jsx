import React, { useState, useEffect } from 'react';
import ApplicationLoadingOverlay from '@cerner/terra-application/lib/application-loading-overlay';

// Wait half a second before showing the loading indicator.
const LoadingOverlay = () => {
  const [state, setState] = useState({ isOpen: false });

  useEffect(() => {
    let isActive = true;
    setTimeout(() => {
      if (isActive) {
        setState({ isOpen: true });
      }
    }, 500);
    return () => { isActive = false; };
  }, []);

  return (
    <div data-terra-dev-site-loading data-terra-test-loading>
      <ApplicationLoadingOverlay isOpen={state.isOpen} />
    </div>
  );
};

export default LoadingOverlay;