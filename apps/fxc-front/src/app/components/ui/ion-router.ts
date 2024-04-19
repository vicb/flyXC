// from ionic-framework/core/components/ion-router.js (my-router branch)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

/*!
 * (C) Ionic http://ionicframework.com - MIT License
 */
import { proxyCustomElement, HTMLElement, createEvent } from '@stencil/core/internal/client';
import { c as componentOnReady, o as debounce } from '@ionic/core/components/helpers.js';

const ROUTER_INTENT_NONE = 'root';
const ROUTER_INTENT_FORWARD = 'forward';
const ROUTER_INTENT_BACK = 'back';

/**
 * Activates the passed route chain.
 *
 * There must be exactly one outlet per route entry in the chain.
 *
 * The methods calls setRouteId on each of the outlet with the corresponding route entry in the chain.
 * setRouteId will create or select the view in the outlet.
 */
const writeNavState = async (root, chain, direction, index, changed = false, animation) => {
  try {
    // find next navigation outlet in the DOM
    const outlet = searchNavNode(root);
    // make sure we can continue interacting the DOM, otherwise abort
    if (index >= chain.length || !outlet) {
      return changed;
    }
    await new Promise((resolve) => componentOnReady(outlet, resolve));
    const node = chain[index];
    const result = await outlet.setRouteId(node.node.id, node.params, direction, animation);
    // if the outlet changed the page, reset navigation to neutral (no direction)
    // this means nested outlets will not animate
    if (result.changed) {
      direction = ROUTER_INTENT_NONE;
      changed = true;
    }
    // recursively set nested outlets
    changed = await writeNavState(result.element, chain, direction, index + 1, changed, animation);
    // once all nested outlets are visible let's make the parent visible too,
    // using markVisible prevents flickering
    if (result.markVisible) {
      await result.markVisible();
    }
    return changed;
  } catch (e) {
    console.error(e);
    return false;
  }
};
const waitUntilNavNode = () => {
  if (searchNavNode(document.body)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.addEventListener('ionNavWillLoad', () => resolve(), { once: true });
  });
};
/** Selector for all the outlets supported by the router. */
const OUTLET_SELECTOR = ':not([no-router]) ion-nav, :not([no-router]) ion-tabs, :not([no-router]) ion-router-outlet';
const searchNavNode = (root) => {
  if (!root) {
    return undefined;
  }
  if (root.matches(OUTLET_SELECTOR)) {
    return root;
  }
  const outlet = root.querySelector(OUTLET_SELECTOR);
  return outlet !== null && outlet !== void 0 ? outlet : undefined;
};

/**
 * Merges the route parameter objects.
 *
 * @returns The merged string objects or undefined when both parameters are undefined.
 */
const mergeParams = (a, b) => {
  return a || b ? Object.assign(Object.assign({}, a), b) : undefined;
};
/** Returns the segments at given level and '' is the index is after any segments */
const getSegmentAtOrEmpty = (segments, index) => (index < segments.length ? segments[index] : '');
/**
 * Recursively matches the segments against the node.
 *
 * @param segments The path as a list of segment.
 * @param node The current node in the route tree.
 * @param chains Accumulates the chains matching the segments (output).
 * @param segIndex The current index in the segments (internal state).
 * @param chain The current (partial) chain (internal state).
 */
const matchNodeVsSegments = (segments, node, chains, segIndex = 0, chain = []) => {
  const nodeSegments = node.segments;
  // Do not consume segments when the node is a default route.
  const matchesDefault = nodeSegments[0] === '';
  // A fallback route is at the top level, has only one "*" segment and no children.
  const isFallback =
    chain.length === 0 && nodeSegments.length === 1 && nodeSegments[0] === '*' && node.children.length === 0;
  // Segment parameters for the current level.
  const segParams = {};
  if (!isFallback && !matchesDefault) {
    for (const segment of nodeSegments) {
      const pathSlice = getSegmentAtOrEmpty(segments, segIndex);
      segIndex++;
      if (segment[0] === ':') {
        if (pathSlice === '') {
          return;
        }
        segParams[segment.slice(1)] = pathSlice;
      } else if (pathSlice !== segment) {
        return;
      }
    }
  }
  // Copy the chain to pass to the next level down the tree.
  chain = [
    ...chain,
    {
      node,
      params: mergeParams(node.params, segParams),
    },
  ];
  if (node.children.length > 0) {
    // Walk down the tree until terminal nodes.
    for (const childNode of node.children) {
      matchNodeVsSegments(segments, childNode, chains, segIndex, chain);
    }
  } else {
    if (!isFallback && matchesDefault && getSegmentAtOrEmpty(segments, segIndex) !== '') {
      // We must be at the end of the segments if the last node matched a default route.
      return;
    }
    // Push the matching chain.
    chains.push(chain);
  }
};
/**
 * Finds the best match for the segments in the tree.
 *
 * @param segments The path as a list of segments.
 * @param tree The root node of the route tree,
 *
 * @returns The best ResolvedRoute match or null when no match is found.
 */
const findChainForSegments = (segments, tree) => {
  const chains = [];
  // Resolve all the matching chains.
  for (const node of tree.children) {
    matchNodeVsSegments(segments, node, chains);
  }
  // Find the best match amongst the matches.
  let match = null;
  let bestScore = 0;
  for (const chain of chains) {
    const score = computePriority(chain);
    if (score > bestScore) {
      bestScore = score;
      match = chain;
    }
  }
  return match;
};
/**
 * Computes the priority of a chain.
 *
 * Parameter segments are given a lower priority over fixed segments.
 *
 * Considering the following 2 chains matching the path /path/to/page:
 * - /path/to/:where
 * - /path/to/page
 *
 * The second one will be given a higher priority because "page" is a fixed segment (vs ":where", a parameter segment).
 */
const computePriority = (chain) => {
  // The fallback route has a priority of 1.
  if (chain.length === 1 && chain[0].node.segments.length === 1 && chain[0].node.segments[0] === '*') {
    return 1;
  }
  let score = 2;
  let level = 1;
  for (const node of chain) {
    for (const segment of node.node.segments) {
      if (segment[0] === ':') {
        score += Math.pow(1, level);
      } else if (segment !== '') {
        score += Math.pow(2, level);
      }
      level++;
    }
  }
  return score;
};

/** Join the non empty segments with "/". */
const generatePath = (segments, queryString = undefined) => {
  let path = segments.filter((s) => s.length > 0).join('/');
  if (queryString !== undefined) {
    path += `?${queryString}`;
  }
  return '/' + path;
};
const generateUrl = (segments, useHash, queryString) => {
  let url = generatePath(segments);
  if (useHash) {
    url = '#' + url;
  }
  if (queryString !== undefined) {
    url += '?' + queryString;
  }
  return url;
};
const writeSegments = (history, root, useHash, segments, direction, state, queryString) => {
  const url = generateUrl([...parsePath(root).segments, ...segments], useHash, queryString);
  if (direction === ROUTER_INTENT_FORWARD) {
    history.pushState(state, '', url);
  } else {
    history.replaceState(state, '', url);
  }
};
/**
 * Removes the prefix segments from the path segments.
 *
 * Return:
 * - null when the path segments do not start with the passed prefix,
 * - the path segments after the prefix otherwise.
 */
const removePrefix = (prefix, segments) => {
  if (prefix.length > segments.length) {
    return null;
  }
  if (prefix.length <= 1 && prefix[0] === '') {
    return segments;
  }
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== segments[i]) {
      return null;
    }
  }
  if (segments.length === prefix.length) {
    return [''];
  }
  return segments.slice(prefix.length);
};
const readParsedRoute = (loc, root, useHash) => {
  const prefix = parsePath(root).segments;
  const pathname = useHash ? loc.hash.slice(1) : loc.pathname;
  const segments = removePrefix(prefix, parsePath(pathname).segments);
  let queryString = undefined;
  if (loc.search.length > 1) {
    queryString = loc.search.slice(1);
  }
  return {
    segments: segments !== null && segments !== void 0 ? segments : [''],
    queryString,
  };
};
/**
 * Parses the path to:
 * - segments an array of '/' separated parts,
 * - queryString (undefined when no query string).
 */
const parsePath = (path) => {
  let segments = [''];
  let queryString = undefined;
  if (path != null) {
    const qsStart = path.indexOf('?');
    if (qsStart > -1) {
      queryString = path.substring(qsStart + 1);
      path = path.substring(0, qsStart);
    }
    segments = path
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (segments.length === 0) {
      segments = [''];
    }
  }
  return { segments, queryString };
};

const readProp = (el, prop) => {
  if (prop in el) {
    return el[prop];
  }
  if (el.hasAttribute(prop)) {
    return el.getAttribute(prop);
  }
  return null;
};
/**
 * Extracts all the routes (that is <ion-route> elements inside the root).
 *
 * The routes are returned as a tree.
 */
const readRouteTree = (element) => {
  return {
    id: '<root>',
    segments: [],
    params: undefined,
    children: readRouteNodes(element),
  };
};
/**
 * Reads the route nodes as a tree modeled after the DOM tree of <ion-route> elements.
 *
 * Note: routes without a component are ignored together with their children.
 */
const readRouteNodes = (node) => {
  return Array.from(node.children)
    .filter((el) => el.tagName === 'ION-ROUTE' && el.component)
    .map((el) => {
      const component = readProp(el, 'component');
      return {
        segments: parsePath(readProp(el, 'url')).segments,
        id: component.toLowerCase(),
        params: el.componentProps,
        beforeLeave: el.beforeLeave,
        beforeEnter: el.beforeEnter,
        children: readRouteNodes(el),
      };
    });
};

const resolveNavigation = async (fromPath, toPath, tree, numRedirects = 0) => {
  if (numRedirects > 200) {
    console.error(`[ion-router] redirect loop detected`);
    return false;
  }
  const parsedFrom = parsePath(fromPath);
  const fromChain = findChainForSegments(parsedFrom.segments, tree);
  const parsedTo = parsePath(toPath);
  const toChain = findChainForSegments(parsedTo.segments, tree);
  let index = 0;
  if (toChain === null) {
    console.error(`[ion-router] the target path "${toPath}" does not match any route`);
    return false;
  }
  if (fromPath !== null) {
    if (fromChain === null) {
      console.error(`[ion-router] the source path "${fromPath}" does not match any route`);
      return false;
    }
    index = fromChain.length - 1;
    while (index >= 0) {
      if (index < toChain.length && fromChain[index].node === toChain[index].node) {
        break;
      }
      const beforeLeaveHook = fromChain[index].node.beforeLeave;
      const canLeave = beforeLeaveHook ? await beforeLeaveHook() : true;
      if (canLeave === false) {
        return false;
      }
      if (canLeave.redirect) {
        return await resolveNavigation(null, canLeave.redirect, tree, numRedirects + 1);
      }
      index--;
    }
    index++;
  }
  for (; index < toChain.length; index++) {
    const beforeEnterHook = toChain[index].node.beforeEnter;
    const canEnter = beforeEnterHook ? await beforeEnterHook() : true;
    if (canEnter === false) {
      return false;
    }
    if (canEnter.redirect) {
      return await resolveNavigation(null, canEnter.redirect, tree, numRedirects + 1);
    }
  }
  return parsedTo;
};

const Router = /*@__PURE__*/ proxyCustomElement(
  class Router extends HTMLElement {
    constructor() {
      super();
      this.__registerHost();
      this.ionRouteWillChange = createEvent(this, 'ionRouteWillChange', 7);
      this.ionRouteDidChange = createEvent(this, 'ionRouteDidChange', 7);
      this.previousPath = null;
      this.busy = false;
      /** State for the next push */
      this.state = 0;
      /** Current state we are in */
      this.lastState = 0;
      this.root = '/';
      this.useHash = true;
    }
    async componentWillLoad() {
      await waitUntilNavNode();
      const parsedRoute = this.getParsedRoute();
      const tree = readRouteTree(this.el);
      const resolvedRoute = await resolveNavigation(
        null,
        generatePath(parsedRoute.segments, parsedRoute.queryString),
        tree,
      );
      if (resolvedRoute === false) {
        return;
      }
      this.setSegments(resolvedRoute.segments, ROUTER_INTENT_NONE, resolvedRoute.queryString);
      await this.writeNavStateRoot(resolvedRoute.segments, ROUTER_INTENT_NONE);
    }
    componentDidLoad() {
      window.addEventListener('ionRouteDataChanged', debounce(this.onRoutesChanged.bind(this), 100));
    }
    async onPopState() {
      let direction = this.historyDirection();
      const parsedRoute = this.getParsedRoute();
      const tree = readRouteTree(this.el);
      const resolvedRoute = await resolveNavigation(
        this.previousPath,
        generatePath(parsedRoute.segments, parsedRoute.queryString),
        tree,
      );
      if (resolvedRoute === false) {
        const path = parsePath(this.previousPath);
        this.setSegments(path.segments, ROUTER_INTENT_FORWARD, path.queryString);
        this.writeNavStateRoot(path.segments, ROUTER_INTENT_FORWARD);
      } else {
        if (generatePath(parsedRoute.segments) !== generatePath(resolvedRoute.segments)) {
          this.setSegments(resolvedRoute.segments, ROUTER_INTENT_FORWARD, resolvedRoute.queryString);
          direction = ROUTER_INTENT_FORWARD;
        }
        this.writeNavStateRoot(resolvedRoute.segments, direction);
      }
    }
    onBackButton(ev) {
      ev.detail.register(0, (processNextHandler) => {
        this.back();
        processNextHandler();
      });
    }
    async canTransition() {
      return false;
    }
    /**
     * Navigate to the specified path.
     *
     * @param path The path to navigate to.
     * @param direction The direction of the animation. Defaults to `"forward"`.
     */
    async push(path, direction = 'forward', animation) {
      let _a;
      if (path.startsWith('.')) {
        const currentPath = (_a = this.previousPath) !== null && _a !== void 0 ? _a : '/';
        // Convert currentPath to an URL by pre-pending a protocol and a host to resolve the relative path.
        const url = new URL(path, `https://host/${currentPath}`);
        path = url.pathname + url.search;
      }
      const fromRoute = this.getParsedRoute();
      const toRoute = parsePath(path);
      const tree = readRouteTree(this.el);
      const resolvedRoute = await resolveNavigation(
        generatePath(fromRoute.segments, fromRoute.queryString),
        generatePath(toRoute.segments, toRoute.queryString),
        tree,
      );
      if (resolvedRoute === false) {
        return false;
      }
      this.setSegments(resolvedRoute.segments, direction, resolvedRoute.queryString);
      return this.writeNavStateRoot(resolvedRoute.segments, direction, animation);
    }
    /** Go back to previous page in the window.history. */
    back() {
      window.history.back();
      return Promise.resolve(this.waitPromise);
    }
    /** @internal */
    async navChanged(_) {
      return false;
    }
    /** This handler gets called when a `ion-route` component is added to the DOM or if the from or to property of such node changes. */
    onRoutesChanged() {
      const parsedRoute = this.getParsedRoute();
      return this.writeNavStateRoot(parsedRoute.segments, ROUTER_INTENT_NONE);
    }
    historyDirection() {
      let _a;
      const win = window;
      if (win.history.state === null) {
        this.state++;
        win.history.replaceState(
          this.state,
          win.document.title,
          (_a = win.document.location) === null || _a === void 0 ? void 0 : _a.href,
        );
      }
      const state = win.history.state;
      const lastState = this.lastState;
      this.lastState = state;
      if (state > lastState || (state >= lastState && lastState > 0)) {
        return ROUTER_INTENT_FORWARD;
      }
      if (state < lastState) {
        return ROUTER_INTENT_BACK;
      }
      return ROUTER_INTENT_NONE;
    }
    async writeNavStateRoot(segments, direction, animation) {
      if (!segments) {
        console.error('[ion-router] URL is not part of the routing set');
        return false;
      }
      // lookup route chain
      const chain = findChainForSegments(segments, readRouteTree(this.el));
      if (!chain) {
        console.error('[ion-router] the path does not match any route');
        return false;
      }
      // write DOM give
      const unlock = await this.lock();
      let changed = false;
      try {
        changed = await this.writeNavState(document.body, chain, direction, segments, animation);
      } catch (e) {
        console.error(e);
      }
      unlock();
      return changed;
    }
    async lock() {
      const p = this.waitPromise;
      let resolve;
      this.waitPromise = new Promise((r) => (resolve = r));
      if (p !== undefined) {
        await p;
      }
      return resolve;
    }
    async writeNavState(node, chain, direction, segments, animation) {
      if (this.busy) {
        console.warn('[ion-router] router is busy, transition was cancelled');
        return false;
      }
      this.busy = true;
      // generate route event and emit will change
      const routeEvent = this.routeChangeEvent(segments, null);
      if (routeEvent) {
        this.ionRouteWillChange.emit(routeEvent);
      }
      const changed = await writeNavState(node, chain, direction, 0, false, animation);
      this.busy = false;
      // emit did change
      if (routeEvent) {
        this.ionRouteDidChange.emit(routeEvent);
      }
      return changed;
    }
    setSegments(segments, direction, queryString) {
      this.state++;
      this.lastState = this.state;
      writeSegments(window.history, this.root, this.useHash, segments, direction, this.state, queryString);
    }
    getParsedRoute() {
      return readParsedRoute(location, this.root, this.useHash);
    }
    routeChangeEvent(toSegments, redirectFromSegments) {
      const from = this.previousPath;
      const to = generatePath(toSegments);
      this.previousPath = to;
      if (to === from) {
        return null;
      }
      const redirectedFrom = redirectFromSegments ? generatePath(redirectFromSegments) : null;
      return {
        from,
        redirectedFrom,
        to,
      };
    }
    get el() {
      return this;
    }
  },
  [
    0,
    'ion-router',
    {
      root: [1],
      useHash: [4, 'use-hash'],
      canTransition: [64],
      push: [64],
      back: [64],
      navChanged: [64],
    },
    [
      [8, 'popstate', 'onPopState'],
      [4, 'ionBackButton', 'onBackButton'],
    ],
  ],
);
function defineCustomElement$1() {
  if (typeof customElements === 'undefined') {
    return;
  }
  const components = ['ion-router'];
  components.forEach((tagName) => {
    switch (tagName) {
      case 'ion-router':
        if (!customElements.get(tagName)) {
          customElements.define(tagName, Router);
        }
        break;
    }
  });
}

const IonRouter = Router;
const defineCustomElement = defineCustomElement$1;

export { IonRouter, defineCustomElement };
