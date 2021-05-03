import React from 'react';
import classNames from 'classnames/bind';
import { KEY_ESCAPE } from 'keycode-js';
import IconLeftPane from 'terra-icon/lib/icon/IconLeftPane';
import { ActiveBreakpointContext } from '@cerner/terra-application/lib/breakpoints';
import SkipToButton from '@cerner/terra-application/lib/application-container/private/skip-to/SkipToButton';
import MainPageContainer from '@cerner/terra-application/lib/page/MainPageContainer';
import { useDismissTransientPresentationsEffect } from '@cerner/terra-application/lib/utils/transient-presentations';
import { deferExecution } from '@cerner/terra-application/lib/utils/lifecycle-utils';
import usePortalManager from '@cerner/terra-application/lib/shared/usePortalManager';

import LayoutActionsContext from '@cerner/terra-application/lib/layouts/shared/LayoutActionsContext';
import NavigationItem from '@cerner/terra-application/lib/layouts/shared/NavigationItem';

import SecondaryNavigationGroup from './SecondaryNavigationGroup';
import CollapsingNavigationMenu from './side-nav/CollapsingNavigationMenu';
import SideNavHeader from './side-nav/SideNavHeader';

import styles from './SecondaryNavigationLayout.module.scss';

const cx = classNames.bind(styles);

const sideNavOverlayBreakpoints = ['tiny', 'small', 'medium'];

const propTypes = {};

function mapChildItem(item) {
  return {
    text: item.label,
    name: item.label,
    path: item.key,
    childItems: item.childItems ? item.childItems.map(mapChildItem) : undefined,
  };
}

const DefaultSideNavPanel = ({
  id, label, activeNavigationKey, onSelectNavigationItem, items, onDismiss,
}) => (
  <div className={cx('sidebar-container')}>
    <div className={cx('header-container')}>
      <SideNavHeader label={label} onRequestClose={onDismiss} />
    </div>
    <div className={cx('content')}>
      <CollapsingNavigationMenu
        id={id}
        selectedPath={activeNavigationKey}
        onSelect={(key) => { onSelectNavigationItem(key); }}
        menuItems={[{
          childItems: items.map(mapChildItem),
        }]}
      />
    </div>
  </div>
);

const SecondaryNavigationLayout = ({
  id,
  label,
  sidebar,
  activeNavigationKey,
  children,
  onSelectNavigationItem,
  renderPage,
  renderLayout,
  renderNavigationFallback,
}) => {
  const activeBreakpoint = React.useContext(ActiveBreakpointContext);
  const parentLayoutActions = React.useContext(LayoutActionsContext);

  const pageContainerRef = React.useRef();
  const sideNavBodyRef = React.useRef();
  const sideNavPanelRef = React.useRef();
  const resizeOverlayRef = React.useRef();

  const [contentElementRef, pageContainerPortalsRef] = usePortalManager(activeNavigationKey, () => {
    deferExecution(() => {
      document.body.focus();
    });
  });

  const [sideNavOverlayIsVisible, setSideNavOverlayIsVisible] = React.useState(false);

  function getNavigationItems(childComponents) {
    return React.Children.toArray(childComponents).reduce((accumulator, child) => {
      const items = [...accumulator];

      if (child.type === NavigationItem) {
        items.push(child);
      } else if (child.type === SecondaryNavigationGroup) {
        const groupItems = getNavigationItems(child.props.children);
        if (groupItems) {
          items.push(...groupItems);
        }
      }

      return items;
    }, []);
  }

  const navigationItems = getNavigationItems(children);
  const hasActiveNavigationItem = !!navigationItems.find(item => item.props.navigationKey === activeNavigationKey);

  const hasSidebar = !!navigationItems.length;
  const hasOverlaySidebar = sideNavOverlayBreakpoints.indexOf(activeBreakpoint) !== -1;
  const sideNavIsVisible = hasSidebar && (sideNavOverlayIsVisible || sideNavOverlayBreakpoints.indexOf(activeBreakpoint) === -1);

  const layoutActionsContextValue = React.useMemo(() => {
    let newStartActions = parentLayoutActions.startActions;

    if (hasSidebar && hasOverlaySidebar) {
      newStartActions = [...newStartActions, {
        key: 'secondary-navigation-layout-toggle-navigation-panel',
        label: `Toggle Navigation Panel ${sideNavOverlayIsVisible ? 'Closed' : 'Open'}`, // TODO intl and verify a11y
        icon: IconLeftPane,
        onSelect: () => {
          setSideNavOverlayIsVisible((state) => !state);
        },
      }];
    }

    return ({
      startActions: newStartActions,
      endActions: parentLayoutActions.endActions,
    });
  }, [parentLayoutActions.startActions, parentLayoutActions.endActions, hasSidebar, hasOverlaySidebar, sideNavOverlayIsVisible]);

  useDismissTransientPresentationsEffect(() => {
    if (hasOverlaySidebar) {
      setSideNavOverlayIsVisible(false);
    }
  });

  React.useEffect(() => {
    const navigationItemKeys = navigationItems.map(item => item.props.navigationKey);
    // Cleanup nodes for removed children
    const danglingPortalKeys = Object.keys(pageContainerPortalsRef.current).filter((itemKey) => !navigationItemKeys.includes(itemKey));
    danglingPortalKeys.forEach((pageKey) => {
      delete pageContainerPortalsRef.current[pageKey];
    });
  }, [navigationItems, pageContainerPortalsRef]);

  const lastNavigationPanelOpenState = React.useRef(sideNavOverlayIsVisible);
  React.useEffect(() => {
    if (sideNavOverlayIsVisible && !lastNavigationPanelOpenState.current) {
      deferExecution(() => { sideNavPanelRef.current.focus(); });
    } else if (!sideNavOverlayIsVisible && lastNavigationPanelOpenState.current) {
      deferExecution(() => {
        const mainElement = document.querySelector('main');
        if (mainElement) {
          mainElement.focus();
        }
      });
    }

    lastNavigationPanelOpenState.current = sideNavOverlayIsVisible;
  }, [sideNavOverlayIsVisible]);

  React.useEffect(() => {
    if (!sideNavOverlayIsVisible) {
      return undefined;
    }

    function handleKeydown(e) {
      if (e.keyCode === KEY_ESCAPE) {
        if (e.target === pageContainerRef.current || pageContainerRef.current.contains(e.target)) {
          setSideNavOverlayIsVisible(false);
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [sideNavOverlayIsVisible, setSideNavOverlayIsVisible]);

  function activatePage(pageKey) {
    setSideNavOverlayIsVisible(false);

    if (pageKey === activeNavigationKey) {
      return;
    }

    onSelectNavigationItem(pageKey);
  }

  function renderNavigationItems() {
    return navigationItems.map((item) => {
      let portalElement = pageContainerPortalsRef.current[item.props.navigationKey]?.element;
      if (!portalElement) {
        portalElement = document.createElement('div');
        portalElement.style.position = 'relative';
        portalElement.style.height = '100%';
        portalElement.style.width = '100%';
        portalElement.id = `side-nav-${item.props.navigationKey}`;
        pageContainerPortalsRef.current[item.props.navigationKey] = {
          element: portalElement,
        };
      }

      /**
       * The cloned element is wrapped in a keyed fragment to ensure the render order of
       * the mapped items.
       */
      return (
        <React.Fragment key={item.props.navigationKey}>
          {React.cloneElement(item, {
            isActive: item.props.navigationKey === activeNavigationKey, portalElement,
          })}
        </React.Fragment>
      );
    });
  }

  function buildSideNavItems(childComponents) {
    return React.Children.map(childComponents, (child) => {
      if (child.type === NavigationItem) {
        return { key: child.props.navigationKey, label: child.props.label };
      }

      if (child.type === SecondaryNavigationGroup) {
        return { key: child.props.label, label: child.props.label, childItems: buildSideNavItems(child.props.children) };
      }

      return null;
    });
  }

  let content;
  if (renderPage) {
    content = (
      <MainPageContainer>
        {renderPage()}
      </MainPageContainer>
    );
  } else if (renderLayout) {
    content = renderLayout();
  } else if (navigationItems.length) {
    content = (
      <>
        {renderNavigationItems()}
        {!hasActiveNavigationItem && renderNavigationFallback ? renderNavigationFallback() : undefined}
      </>
    );
  } else {
    content = children;
  }

  return (
    <>
      {hasSidebar && (
        <SkipToButton
          description="Side Navigation"
          onSelect={() => {
            if (hasOverlaySidebar) {
              setSideNavOverlayIsVisible(true);
            } else {
              deferExecution(() => {
                sideNavPanelRef.current.focus();
              });
            }
          }}
        />
      )}
      <div
        className={cx('side-nav-container')}
        ref={pageContainerRef}
      >
        <div
          ref={resizeOverlayRef}
          style={{
            position: 'absolute',
            left: '0',
            right: '0',
            top: '0',
            bottom: '0',
            zIndex: '5', // TODO 5 is very important for safari, validate final value for this
            display: 'none',
            cursor: 'col-resize',
          }}
        />
        <div
          ref={sideNavPanelRef}
          className={cx('side-nav-sidebar', { visible: hasSidebar && sideNavIsVisible, overlay: hasOverlaySidebar })}
          tabIndex="-1"
        >
          {sidebar || (hasSidebar && (
            <DefaultSideNavPanel
              id={`${id}-side-nav`}
              label={label}
              onDismiss={sideNavOverlayIsVisible ? () => {
                setSideNavOverlayIsVisible(false);
              } : undefined}
              activeNavigationKey={activeNavigationKey}
              onSelectNavigationItem={activatePage}
              items={buildSideNavItems(children)}
            />
          ))}
        </div>
        <div ref={sideNavBodyRef} className={cx('side-nav-body')}>
          <div
            ref={contentElementRef}
            className={cx('page-body')}
            inert={sideNavOverlayIsVisible ? 'true' : null}
          >
            <LayoutActionsContext.Provider value={layoutActionsContextValue}>
              {content}
            </LayoutActionsContext.Provider>
          </div>
        </div>
      </div>
    </>
  );
};

SecondaryNavigationLayout.propTypes = propTypes;

export default SecondaryNavigationLayout;
