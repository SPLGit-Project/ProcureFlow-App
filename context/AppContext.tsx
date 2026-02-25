
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, UserPreferences, PORequest, Supplier, Item, ApprovalEvent, DeliveryHeader, DeliveryLineItem, POLineItem, POStatus, SupplierCatalogItem, SupplierStockSnapshot, AppBranding, Site, WorkflowStep, NotificationRule, UserRole, RoleDefinition, Permission, PermissionId, SupplierProductMap, ProductAvailability, NotificationEventType, AttributeOption, SystemAuditLog } from '../types.ts';
import { db } from '../services/db.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { Session } from '@supabase/supabase-js';
import { DirectoryService } from '../services/graphService.ts';
import {
    MOCK_USERS,
    MOCK_ROLES,
    MOCK_SITES,
    MOCK_SUPPLIERS,
    MOCK_ITEMS,
    MOCK_CATALOG,
    MOCK_SNAPSHOTS,
    MOCK_POS,
    MOCK_WORKFLOW_STEPS,
    MOCK_NOTIFICATIONS
} from '../services/mockData.ts';

// Helper to get raw site filter from localStorage or user defaults
const getInitialSiteIds = (): string[] => {
    try {
        const stored = localStorage.getItem('activeSiteIds');
        if (stored) {
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        }
        // Fallback for migration: check old key
        const oldSingle = localStorage.getItem('activeSiteId');
        if (oldSingle && oldSingle !== 'null') return [oldSingle];
        return [];
    } catch {
        return [];
    }
};

const isLocalQaMode = (): boolean => {
    if (typeof globalThis.window === 'undefined') return false;
    const host = globalThis.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    if (!isLocalhost) return false;

    const params = new URLSearchParams(globalThis.location.search);
    if (params.get('qa') === '1') {
        localStorage.setItem('pf_qa_mode', '1');
        return true;
    }

    return localStorage.getItem('pf_qa_mode') === '1';
};

interface AppContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  activeSiteIds: string[]; // Multi-site context
  setActiveSiteIds: (ids: string[]) => void;
  siteName: (siteId?: string) => string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isLoadingAuth: boolean;
  isPendingApproval: boolean;
  isLoadingData: boolean;

  // User Management
  users: User[];
  roles: RoleDefinition[];
  updateUserRole: (userId: string, role: UserRole) => void;
  updateUserAccess: (userId: string, role: UserRole, siteIds: string[]) => Promise<void>;
  addUser: (user: User, shouldSendInvite?: boolean) => Promise<void>;
  archiveUser: (userId: string) => Promise<void>;
  permissions: Permission[];
  hasPermission: (permissionId: PermissionId) => boolean;
  createRole: (role: RoleDefinition) => Promise<void>;
  updateRole: (role: RoleDefinition) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;
  
  // Teams Integration
  teamsWebhookUrl: string;
  updateTeamsWebhook: (url: string) => Promise<void>;

  reloadData: (silent?: boolean) => Promise<void>;

  // Theme & Branding
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  branding: AppBranding;
  updateBranding: (branding: AppBranding) => Promise<void>;

  pos: PORequest[];
  allPos: PORequest[];
  suppliers: Supplier[];
  items: Item[];
  sites: Site[];
  userSites: Site[]; // Sites the current user has access to (admins see all)
  catalog: SupplierCatalogItem[];
  stockSnapshots: SupplierStockSnapshot[];
  
  // Master Product / Mapping / Availability
  mappings: SupplierProductMap[];
  availability: ProductAvailability[];
  importMasterProducts: (newItems: Partial<Item>[], archiveMissing?: boolean) => Promise<{ created: number; updated: number; deactivated: number; skipped: number }>;
  generateMappings: () => Promise<void>;
  updateMapping: (map: SupplierProductMap) => Promise<void>;
  refreshAvailability: (snapshotsOverride?: SupplierStockSnapshot[], mappingsOverride?: SupplierProductMap[]) => Promise<void>;
  runDataBackfill: () => Promise<void>;
  
  // Admin / Workflow / Notifications
  workflowSteps: WorkflowStep[];
  updateWorkflowStep: (step: WorkflowStep) => Promise<void>;
  addWorkflowStep: (step: WorkflowStep) => Promise<void>;
  deleteWorkflowStep: (id: string) => Promise<void>;

  notificationRules: NotificationRule[];
  upsertNotificationRule: (rule: NotificationRule) => Promise<void>;
  deleteNotificationRule: (id: string) => Promise<void>;
  
  // Core Actions
  createPO: (po: PORequest) => void;
  updatePendingPO: (poId: string, updates: { customerName?: string; reasonForRequest?: 'Depletion' | 'New Customer' | 'Other'; comments?: string; lines: POLineItem[]; }) => Promise<void>;
  updatePOStatus: (poId: string, status: POStatus, event: ApprovalEvent) => void;
  linkConcurPO: (poId: string, concurPoNumber: string) => void;
  addDelivery: (poId: string, delivery: DeliveryHeader, closedLineIds?: string[]) => void;
  
  // User Actions
  updateProfile: (profile: Partial<User>) => Promise<void>;
  switchRole: (roleId: UserRole) => void;
  
  // Finance Actions
  updateFinanceInfo: (poId: string, deliveryId: string, lineId: string, updates: Partial<DeliveryLineItem>) => void;
  
  // Settings / Stock Methods
  addSnapshot: (snapshot: SupplierStockSnapshot) => void;
  importStockSnapshot: (supplierId: string, date: string, snapshots: SupplierStockSnapshot[]) => Promise<void>;
  updateCatalogItem: (item: SupplierCatalogItem) => Promise<void>;
  upsertProductMaster: (items: Partial<Item>[], archiveMissing?: boolean) => Promise<{ created: number; updated: number; deactivated: number; skipped: number }>;
  
  // Catalog Management
  attributeOptions: AttributeOption[];
  getAttributeOptions: (type?: string) => Promise<AttributeOption[]>;
  upsertAttributeOption: (option: Partial<AttributeOption>) => Promise<void>;
  deleteAttributeOption: (id: string) => Promise<void>;

  // New Admin Capabilities
  getItemFieldRegistry: () => Promise<unknown[]>;
  sendWelcomeEmail: (toEmail: string, name: string, siteIdOverride?: string) => Promise<boolean>;
  resendWelcomeEmail: (email: string, name: string, siteId?: string) => Promise<boolean>;
  getDirectoryService: () => Promise<DirectoryService | null>;


  runAutoMapping: (supplierId: string) => Promise<{ confirmed: number, proposed: number }>;
  deletePO: (id: string) => Promise<void>;
  getMappingQueue: (supplierId?: string) => Promise<SupplierProductMap[]>;
  getMappingMemory: (supplierId?: string) => Promise<SupplierProductMap[]>;
  deleteMapping: (id: string) => Promise<void>;
  syncItemsFromSnapshots: (supplierId?: string) => Promise<{ updated: number }>;
  getAuditLogs: (filters?: { startDate?: string, endDate?: string, userId?: string, actionType?: string }) => Promise<SystemAuditLog[]>;
  logAction: (actionType: string, summary: Record<string, unknown>, details?: Record<string, unknown>) => Promise<void>;
  searchDirectory: (query: string, siteIdOverride?: string) => Promise<unknown[]>;

  // Misc
  getEffectiveStock: (itemId: string, supplierId: string) => number;

  // Item Master CRUD
  addItem: (item: Item) => Promise<void>;
  updateItem: (item: Item) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  archiveItem: (itemId: string) => Promise<void>;

  // Supplier CRUD
  addSupplier: (s: Supplier) => Promise<void>;
  updateSupplier: (s: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  // Site CRUD
  addSite: (s: Site) => Promise<void>;
  updateSite: (s: Site) => Promise<void>;
  deleteSite: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const qaMode = isLocalQaMode();
  const qaUser = React.useMemo<User>(() => ({
      ...(MOCK_USERS.find(u => u.role === 'ADMIN') || MOCK_USERS[0]),
      id: 'qa-admin',
      name: 'QA Admin',
      email: 'qa.admin@splservices.com.au',
      role: 'ADMIN',
      realRole: 'ADMIN',
      status: 'APPROVED',
      siteIds: MOCK_SITES.map(s => s.id)
  }), []);

  const mockPosWithSiteIds = React.useMemo(() => {
      return MOCK_POS.map((po, idx) => {
          const fallbackSite = MOCK_SITES[idx % MOCK_SITES.length];
          const siteId = (po as unknown as { siteId?: string }).siteId || fallbackSite.id;
          const site = (po as unknown as { site?: string }).site || fallbackSite.name;
          return {
              ...po,
              siteId,
              site
          };
      }) as PORequest[];
  }, []);

  const [users, setUsers] = useState<User[]>(() => qaMode ? [...MOCK_USERS] : []);
  const [currentUser, setCurrentUser] = useState<User | null>(() => qaMode ? qaUser : null);
  const [isAuthenticated, setIsAuthenticated] = useState(() => qaMode);
  
  // Updated Multi-Site State
  const [activeSiteIds, _setActiveSiteIds] = useState<string[]>(getInitialSiteIds());
  
  const [isLoadingAuth, setIsLoadingAuth] = useState(() => !qaMode);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(() => !qaMode);
  
  const [roles, setRoles] = useState<RoleDefinition[]>(() => qaMode ? [...MOCK_ROLES] : []);
  

  
  // Auth Config is now managed in the backend (env vars/Azure)

  // Theme State
  const [theme, _setTheme] = useState<'light' | 'dark'>(() => {
      const saved = localStorage.getItem('app-theme');
      return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const savePreferences = async (updates: Partial<UserPreferences>) => {
      if (!currentUser) return;
      
      const currentPrefs = currentUser.preferences || { theme, activeSiteIds };
      const newPrefs = { ...currentPrefs, ...updates };

      try {
          const { error } = await supabase
              .from('users')
              .update({ preferences: newPrefs })
              .eq('id', currentUser.id);
          
          if (error) throw error;
          
          setCurrentUser(prev => prev ? ({ ...prev, preferences: newPrefs }) : null);
      } catch (e) {
          console.error("Auth: Failed to persist preferences", e);
      }
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
      _setTheme(newTheme);
      localStorage.setItem('app-theme', newTheme);
      savePreferences({ theme: newTheme });
  };

  // Branding State
  const [branding, setBranding] = useState<AppBranding>(() => {
      const saved = localStorage.getItem('app-branding');
      // Backward compatibility check or default
      if (saved) {
          const parsed = JSON.parse(saved);
          return {
              appName: parsed.appName || 'ProcureFlow',
              logoUrl: parsed.logoUrl || '',
              primaryColor: parsed.primaryColor || '#2563eb', // Default Blue
              secondaryColor: parsed.secondaryColor || '#1e2029', // Default Dark
              fontFamily: parsed.fontFamily || 'sans',
              sidebarTheme: parsed.sidebarTheme || 'system'
          };
      }
      return {
          appName: 'ProcureFlow',
          logoUrl: '', 
          primaryColor: '#2563eb',
          secondaryColor: '#1e2029',
          fontFamily: 'sans',
          sidebarTheme: 'system'
      };
  });

  // Data State
  const [pos, setPos] = useState<PORequest[]>(() => qaMode ? mockPosWithSiteIds : []);
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => qaMode ? [...MOCK_SUPPLIERS] : []);
  const [items, setItems] = useState<Item[]>(() => qaMode ? [...MOCK_ITEMS] : []);
  const [sites, setSites] = useState<Site[]>(() => qaMode ? [...MOCK_SITES] : []);
  const [catalog, setCatalog] = useState<SupplierCatalogItem[]>(() => qaMode ? [...MOCK_CATALOG] : []);
  const [stockSnapshots, setStockSnapshots] = useState<SupplierStockSnapshot[]>(() => qaMode ? [...MOCK_SNAPSHOTS] : []);
  
  // New State
  const [mappings, setMappings] = useState<SupplierProductMap[]>([]);
  const [availability, setAvailability] = useState<ProductAvailability[]>([]);
  const [attributeOptions, setAttributeOptions] = useState<AttributeOption[]>([]);

  // Admin Data State
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(() => qaMode ? [...MOCK_WORKFLOW_STEPS] : []);
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>(() => qaMode ? [...MOCK_NOTIFICATIONS] : []);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');

  // --- Active Site Logic (Multi) ---
    const setActiveSiteIds = (ids: string[]) => {
        // SECURITY: Validate that non-admin users can only select sites they have access to
        let validatedIds = ids;
        if (currentUser && currentUser.role !== 'ADMIN' && currentUser.siteIds && currentUser.siteIds.length > 0) {
            validatedIds = ids.filter(id => currentUser.siteIds.includes(id));
        }

        // Only update if changed
        if (JSON.stringify(validatedIds) === JSON.stringify(activeSiteIds)) return;

        _setActiveSiteIds(validatedIds);
        localStorage.setItem('activeSiteIds', JSON.stringify(validatedIds));
        // Also cleanup old key
        localStorage.removeItem('activeSiteId');

        // Persist to DB
        savePreferences({ activeSiteIds: validatedIds });
    };

    useEffect(() => {
        if (!qaMode) return;
        if (activeSiteIds.length > 0) return;
        const defaults = MOCK_SITES.slice(0, 3).map(s => s.id);
        _setActiveSiteIds(defaults);
        localStorage.setItem('activeSiteIds', JSON.stringify(defaults));
    }, [qaMode, activeSiteIds.length]);

    // --- Computed: Sites the current user has access to ---
    const userSites = React.useMemo(() => {
        if (!currentUser) return [];
        // Admins see all sites
        if (currentUser.role === 'ADMIN') return sites;
        // Non-admins only see their assigned sites
        if (currentUser.siteIds && currentUser.siteIds.length > 0) {
            return sites.filter(s => currentUser.siteIds.includes(s.id));
        }
        return [];
    }, [currentUser, sites]);

    // --- Helper for Site Name ---
    const siteName = useCallback((siteId?: string) => {
        if (!siteId) return 'Unknown Site';
        const site = sites.find(s => s.id === siteId);
        return site ? site.name : 'Unknown Site';
    }, [sites]);

    // --- Data Filtering based on Active Site ---
    const filteredPos = React.useMemo(() => {
        if (!activeSiteIds.length) return []; // STRICT: No sites selected = No data
        return pos.filter(p => activeSiteIds.includes(p.siteId));
    }, [pos, activeSiteIds]);

  // Data Loading
  const lastFetchTime = React.useRef<number>(0);
  const reloadData = useCallback(async (silent: boolean = false) => {
        if (qaMode) {
            setRoles([...MOCK_ROLES]);
            setUsers([...MOCK_USERS]);
            setSites([...MOCK_SITES]);
            setSuppliers([...MOCK_SUPPLIERS]);
            setItems([...MOCK_ITEMS]);
            setCatalog([...MOCK_CATALOG]);
            setStockSnapshots([...MOCK_SNAPSHOTS]);
            setPos([...mockPosWithSiteIds]);
            setWorkflowSteps([...MOCK_WORKFLOW_STEPS]);
            setNotificationRules([...MOCK_NOTIFICATIONS]);
            setMappings([]);
            setAvailability([]);
            setTeamsWebhookUrl('');
            setAttributeOptions([]);
            if (!silent) setIsLoadingData(false);
            return;
        }

        // Smart Sync Check
        const now = Date.now();
        // If silent (smart) sync and data is fresh (< 5 mins), skip
        if (silent && (now - lastFetchTime.current < 5 * 60 * 1000)) {
            console.log("Data is fresh, skipping reload.");
            return;
        }

        // Helper for resilience
        async function safeFetch<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
            try {
                return await promise;
            } catch (e) {
                console.warn(`Failed to load ${label}:`, e);
                return fallback;
            }
        }

        if (!silent && !currentUser) setIsLoadingData(true);
        try {
            // Parallel fetch with individual error handling
            const [
                fetchedRoles,
                fetchedUsers,
                fetchedSites,
                fetchedSuppliers,
                fetchedItems,
                fetchedCatalog,
                fetchedSnapshots,
                fetchedPos,
                fetchedSteps,
                fetchedNotifs,
                fetchedMappings,
                fetchedAvailability,
                fetchedTeamsUrl,
                fetchedBranding,
                fetchedOptions
            ] = await Promise.all([
                safeFetch(db.getRoles(), [], 'roles'),
                safeFetch(db.getUsers(), [], 'users'),
                safeFetch(db.getSites(), [], 'sites'),
                safeFetch(db.getSuppliers(), [], 'suppliers'),
                safeFetch(db.getItems(), [], 'items'),
                safeFetch(db.getCatalog(), [], 'catalog'),
                safeFetch(db.getStockSnapshots(), [], 'snapshots'),
                safeFetch(db.getPOs(activeSiteIds), [], 'pos'), // Filter by multiple sites
                safeFetch(db.getWorkflowSteps(), [], 'workflowSteps'),
                safeFetch(db.getNotificationRules(), [], 'notifications'),
                safeFetch(db.getMappings(), [], 'mappings'),
                safeFetch(db.getProductAvailability(), [], 'availability'),
                safeFetch(db.getTeamsConfig(), '', 'teamsConfig'),
                safeFetch(db.getBranding(), null, 'branding'),
                safeFetch(db.getAttributeOptions(), [], 'attributeOptions')
            ]);

            setRoles(fetchedRoles);
            setUsers(fetchedUsers);
            setSites(fetchedSites);
            setSuppliers(fetchedSuppliers);
            setItems(fetchedItems);
            setCatalog(fetchedCatalog);
            setStockSnapshots(fetchedSnapshots);
            setPos(fetchedPos);
            setWorkflowSteps(fetchedSteps);
            setNotificationRules(fetchedNotifs);
            setMappings(fetchedMappings);
            setAvailability(fetchedAvailability);
            setTeamsWebhookUrl(fetchedTeamsUrl);
            if (fetchedBranding) setBranding(fetchedBranding);
            setAttributeOptions(fetchedOptions);
            
            lastFetchTime.current = Date.now();
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            if (!silent) setIsLoadingData(false);
        }
    }, [activeSiteIds, qaMode, mockPosWithSiteIds]);

    // Trigger reload when active site changes
    useEffect(() => {
        if (isAuthenticated) {
            reloadData();
        }
    }, [activeSiteIds, isAuthenticated, reloadData]);

    // ... (rest of code)
    
    

    // ... (rest of code)
    
    
  // Ref to prevent double-processing of auth events (listener + manual check overlap)
  const isAuthProcessingRef = React.useRef(false);
  const isCheckingSessionRef = React.useRef(false);

  // Auth Initialization
  useEffect(() => {
    let mounted = true;

    if (qaMode) {
        setCurrentUser(qaUser);
        setIsAuthenticated(true);
        setIsPendingApproval(false);
        setIsLoadingAuth(false);
        reloadData(true);
        return () => {
            mounted = false;
        };
    }

    // Safety timeout to ensure we don't get stuck on loading forever
    const safetyTimeout = setTimeout(() => {
        if (mounted && isLoadingAuth) {
            console.warn("Auth: Safety timeout triggered (30s), forcing load state off.");
            setIsLoadingAuth(false);
        }
    }, 30000); // 30 seconds

    const initializeAuth = () => {
        setIsLoadingAuth(true);
        console.log("Auth: Initializing (Smart-Robust Mode)...");

        // 0. Cleanup Stale Locks
        // Supabase sometimes leaves 'sb-lock' keys if a tab crashes, causing deadlocks.
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('sb-lock')) {
                    console.log("Auth: Clearing stale lock:", key);
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.warn("Auth: Failed to clear locks", e);
        }

        // 1. Check for tokens in URL
        const hash = globalThis.location.hash;
        const searchParams = new URLSearchParams(globalThis.location.search);
        const urlError = searchParams.get('error');
        const urlErrorDesc = searchParams.get('error_description');

        if (urlError && mounted) {
            console.error("Auth: URL contains error:", urlError, urlErrorDesc);
            alert(`Sign-in Error: ${urlErrorDesc || urlError}`);
            globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
            setIsLoadingAuth(false);
            return;
        }

        let manualRecoveryTimeout: ReturnType<typeof setTimeout> | undefined;

        // 2. Setup Listener IMMEDIATELY
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            const eventType = event as string;
            console.log(`Auth: Event fired: ${eventType}`, session?.user?.email);

            if (manualRecoveryTimeout) clearTimeout(manualRecoveryTimeout);

            if (eventType === 'TOKEN_REFRESHED') {
                 // Nothing to do, but good to know session is keeping alive
                 console.log("Auth: Session refreshed successfully.");
            } else if (eventType === 'SIGNED_IN' || eventType === 'INITIAL_SESSION') {
                if (session) {
                    await handleUserAuth(session);
                } else if (eventType === 'INITIAL_SESSION') {
                     console.log("Auth: INITIAL_SESSION - No session");
                     // Check if we have a hash that wasn't processed
                     if (globalThis.location.hash && globalThis.location.hash.includes('access_token')) {
                         console.warn("Auth: INITIAL_SESSION fired but hash exists. Supabase missed it?");
                         // Let the manual recovery handle it below
                     } else {
                         setIsLoadingAuth(false);
                     }
                }
            } else if (eventType === 'SIGNED_OUT') {
                console.log("Auth: Signed out");
                setCurrentUser(null);
                setIsAuthenticated(false);
                setIsPendingApproval(false);
                setIsLoadingAuth(false);
                logAction('USER_LOGOUT', { email: session?.user?.email });
            }
        });

        // 3. Manual Token Recovery / Fallback
        // If Supabase doesn't fire SIGNED_IN within 2s and we have a token, force it.
        if (hash && hash.includes('access_token=')) {
            console.log("Auth: OAuth fragment detected. Arming manual recovery...");
            manualRecoveryTimeout = globalThis.setTimeout(async () => {
                if (!mounted || isAuthenticated) return;
                
                console.warn("Auth: Supabase auto-detection timed out. Attempting MANUAL RECOVERY.");
                
                // Parse Hash
                const params = new URLSearchParams(hash.substring(1)); // remove #
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');

                if (access_token) {
                    try {
                        const { data: { session }, error } = await supabase.auth.setSession({
                            access_token,
                            refresh_token: refresh_token || '',
                        });

                        if (error) throw error;
                        
                        if (session) {
                            console.log("Auth: Manual recovery SUCCESS!", session.user.email);
                            await handleUserAuth(session);
                            // Clean URL
                            globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
                        }
                    } catch (e) {
                         console.error("Auth: Manual recovery failed:", e);
                         alert("Authentication failed. Please try signing in again.");
                         setIsLoadingAuth(false);
                    }
                }
            }, 2500); // 2.5s wait
        }

        // 4. Initial Session Check (Debounced/Fallback)
        // Only run this if onAuthStateChange doesn't fire within 500ms
        const initCheckTimeout = setTimeout(() => {
             if (!mounted) return;
             console.log("Auth: No immediate event from listener, checking session manually...");
             
             supabase.auth.getSession().then(({ data: { session }, error }) => {
                if (error) {
                    console.error("Auth: Manual getSession error:", error);
                    if (mounted && isLoadingAuth && !hash) setIsLoadingAuth(false);
                    return;
                }

                if (session && mounted) {
                    if (manualRecoveryTimeout) clearTimeout(manualRecoveryTimeout);
                    console.log("Auth: Manual getSession found session", session.user.id);
                    handleUserAuth(session);
                } else if (mounted && !hash) {
                     // No session, no hash -> probably anon
                     setIsLoadingAuth(false);
                }
            });
        }, 500);

        // Store timeout in a way we can clear if event fires?
        // Actually, we can just let it run, but check isAuthProcessingRef inside handleUserAuth

        return () => {
             subscription?.unsubscribe();
             clearTimeout(initCheckTimeout);
        };
    };

    const handleUserAuth = async (session: Session, silent = false) => {
        if (!mounted) return;
        
        // Prevent concurrent processing
        if (isAuthProcessingRef.current) {
             console.log("Auth: Processing already in progress, skipping duplicate call.");
             return;
        }
        isAuthProcessingRef.current = true;

        if (!silent) setIsLoadingAuth(true);
        try {
            const email = session.user.email?.toLowerCase();
            console.log("Auth: Handling user auth for", email);

            // 1. Security: Domain Lock
            if (!email?.toLowerCase().endsWith('@splservices.com.au')) {
                console.error("Auth: Unauthorized domain:", email);
                alert("Access Restricted: Only @splservices.com.au accounts are allowed.");
                await supabase.auth.signOut();
                logAction('AUTH_FAILED_DOMAIN_RESTRICTION', { email });
                return;
            }

            // 2. Azure AD Graph Sync (Auto-fetch Job/Dept) - DEPRECATED / REMOVED
            // We now rely on the 'sync-directory' Edge Function or DirectoryService if needed.
            // For now, we skip the direct Graph call to avoid 'provider_token' dependency.
            const adProfile = { jobTitle: '', department: '', officeLocation: '' };


            // 3. Fetch user from our DB
            // We prioritize email lookup to handle pre-invited users who have a placeholder UUID 
            // that doesn't yet match their Azure AD auth.uid().
            console.log("Auth: Querying database for user record...");
            let { data: rawData, error } = await supabase
                .from('users')
                .select('*')
                .ilike('email', email) // Use case-insensitive email lookup
                .maybeSingle(); // maybeSingle returns null if not found instead of raising PGRST116

            if (!rawData && !error) {
                // If not found by email, attempt lookup by ID (standard returning users)
                const idResult = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();
                rawData = idResult.data;
                error = idResult.error;
            }

            if (error) {
                console.error("Auth: Error fetching user from DB:", error);
                throw error;
            }

            let userData: User | null = rawData ? {
                id: rawData.id,
                name: rawData.name,
                email: rawData.email,
                role: rawData.role_id,
                realRole: rawData.role_id,
                avatar: rawData.avatar,
                jobTitle: rawData.job_title,
                status: rawData.status,
                createdAt: rawData.created_at,
                siteIds: rawData.site_ids || [],
                department: rawData.department,
                approvalReason: rawData.approval_reason,
                preferences: rawData.preferences
            } : null;

            // 4. JIT Migration: Link Auth ID if missing
            if (rawData && session.user.id && (!rawData.auth_user_id || rawData.auth_user_id !== session.user.id)) {
                 console.log("Auth: Linking user identity...");
                 supabase.rpc('link_user_identity').then(({ error }) => {
                     if (error) console.error("Auth: Failed to link identity", error);
                     else console.log("Auth: Identity linked successfully.");
                 });
            }

            // 5. Load Persistent Preferences
            if (userData?.preferences) {
                const { theme: pTheme, activeSiteIds: pSites } = userData.preferences;
                if (pTheme) {
                    _setTheme(pTheme);
                    localStorage.setItem('app-theme', pTheme);
                }
                if (pSites && Array.isArray(pSites)) {
                    _setActiveSiteIds(pSites);
                    localStorage.setItem('activeSiteIds', JSON.stringify(pSites));
                }
            }

            if (!userData) {
                // 4. New User - Registration or Merge Logic
                console.log("Auth: User not found by ID. Checking by email to merge invitations...");
                
                // Check if user exists by email (Invited by Admin)
                const { data: existingByEmail } = await supabase
                    .from('users')
                    .select('*')
                    .ilike('email', email) // Case insensitive check
                    .single();

                if (existingByEmail) {
                    console.log("Auth: Found pre-invited user. Merging Auth ID...", existingByEmail.id, "->", session.user.id);
                    // Update the placeholder ID to the real Auth ID
                    // This is critical for RLS and consistency
                    const { error: mergeError } = await supabase
                        .from('users')
                        .update({ 
                            id: session.user.id, // Migrate to Auth ID
                            status: 'APPROVED', // Auto-confirm invited users
                            avatar: session.user.user_metadata.avatar_url || existingByEmail.avatar || '',
                            last_sign_in_at: new Date().toISOString()
                        })
                        .eq('id', existingByEmail.id); // Target the old ID

                    if (mergeError) {
                        console.error("Auth: Merge failed", mergeError);
                        // If merge fails (e.g. FK constraints), we might be stuck. 
                        // But for new invites, it usually works.
                        alert("Account setup error: Could not link invitation. Please contact support.");
                        logAction('USER_MERGE_FAILED', { oldId: existingByEmail.id, newId: session.user.id, email, error: mergeError.message });
                        return;
                    }
                    
                    // Reload successfully merged user
                     const { data: mergedUser } = await supabase.from('users').select('*').eq('id', session.user.id).single();
                     if (mergedUser) {
                         userData = {
                            id: mergedUser.id,
                            name: mergedUser.name,
                            email: mergedUser.email,
                            role: mergedUser.role_id,
                            realRole: mergedUser.role_id,
                            avatar: mergedUser.avatar,
                            jobTitle: mergedUser.job_title,
                            status: mergedUser.status,
                            createdAt: mergedUser.created_at,
                            siteIds: mergedUser.site_ids || [],
                            department: mergedUser.department,
                             approvalReason: mergedUser.approval_reason,
                             preferences: mergedUser.preferences
                        };
                        logAction('USER_MERGED_INVITATION', { userId: userData.id, email: userData.email, oldId: existingByEmail.id });
                     }
                } else {
                    // Truly New User
                    console.log("Auth: User not in DB, checking for pre-provisioned email...");
                    
                    const { data: count, error: countError } = await supabase.rpc('get_user_count');
                    const finalCount = countError ? 1 : count; 
                    const isFirstUser = finalCount === 0;

                    // Check for pre-provisioned user (by email) with different ID
                    const { data: preUser } = await supabase.from('users').select('*').ilike('email', session.user.email || '').maybeSingle();
                    
                    let roleToUse = isFirstUser ? 'ADMIN' : 'SITE_USER';
                    let statusToUse = isFirstUser ? 'APPROVED' : 'PENDING_APPROVAL';
                    let sitesToUse: string[] = [];
                    let invitedAtToUse = null;
                    let invitationExpiresAtToUse = null;

                    if (preUser) {
                        console.log("Auth: Found pre-provisioned user, migrating to Auth ID...");
                        roleToUse = preUser.role_id;
                        statusToUse = preUser.status;
                        sitesToUse = preUser.site_ids || [];
                        invitedAtToUse = preUser.invited_at;
                        invitationExpiresAtToUse = preUser.invitation_expires_at;

                        // Delete the placeholder so we can insert the real Auth user
                        await supabase.from('users').delete().eq('id', preUser.id);
                        logAction('USER_PRE_PROVISIONED_MIGRATED', { oldId: preUser.id, newId: session.user.id, email });
                    }

                    const dbUser = {
                        id: session.user.id,
                        email: session.user.email || '',
                        name: session.user.user_metadata.full_name || session.user.user_metadata.name || session.user.email?.split('@')[0] || 'Unknown User',
                        role_id: roleToUse,
                        status: statusToUse,
                        avatar: session.user.user_metadata.avatar_url || session.user.user_metadata.picture || '',
                        job_title: adProfile.jobTitle,
                        department: adProfile.department || adProfile.officeLocation,
                        created_at: new Date().toISOString(),
                        site_ids: sitesToUse,
                        invited_at: invitedAtToUse,
                        invitation_expires_at: invitationExpiresAtToUse
                    };

                    console.log("Auth: Inserting new user:", dbUser.email, "Is First:", isFirstUser);
                    const { error: insertError } = await supabase
                        .from('users')
                        .insert([dbUser]);

                    if (insertError) {
                        console.error("Auth: Registration failed", insertError);
                        logAction('USER_REGISTRATION_FAILED', { email: dbUser.email, error: insertError.message });
                        throw insertError;
                    }
                    
                    // Local object for immediate state
                    userData = {
                        id: dbUser.id,
                        name: dbUser.name,
                        email: dbUser.email,
                        role: dbUser.role_id as UserRole,
                        realRole: dbUser.role_id as UserRole,
                        avatar: dbUser.avatar,
                        jobTitle: dbUser.job_title,
                        status: dbUser.status === 'APPROVED' ? 'APPROVED' : 'PENDING_APPROVAL',
                        createdAt: dbUser.created_at,
                        siteIds: [],
                        department: dbUser.department,
                        preferences: { theme, activeSiteIds }
                    };
                    logAction('USER_REGISTERED', { userId: userData.id, email: userData.email, role: userData.role, status: userData.status });
                }
            }
            else {
                 // Update existing user with latest AD info if valid and different?
                 // For now, only on creation or if we want to sync every login.
                 // Let's sync if fields are empty or mismatched to keep data fresh.
                 const newJob = adProfile.jobTitle;
                 const newDept = adProfile.department || adProfile.officeLocation;
                 
                 if ((newJob && newJob !== userData.jobTitle) || (newDept && newDept !== userData.department)) {
                     console.log("Auth: Syncing outdated profile with AD data...");
                     await supabase.from('users').update({
                         job_title: newJob || userData.jobTitle,
                         department: newDept || userData.department
                     }).eq('id', userData.id);
                     
                     userData.jobTitle = newJob || userData.jobTitle;
                     userData.department = newDept || userData.department;
                     logAction('USER_PROFILE_SYNCED', { userId: userData.id, email: userData.email, jobTitle: newJob, department: newDept });
                 }
            }

            if (mounted) {
                console.log("Auth: Successfully authenticated user:", userData.email, "Status:", userData.status);
                
                setCurrentUser(userData);
                setIsAuthenticated(true);
                setIsPendingApproval(userData.status !== 'APPROVED');
                
                // Initialize Active Site Context
                if (userData.role !== 'ADMIN') {
                     if (userData.siteIds && userData.siteIds.length > 0) {
                         // Ensure currently selected sites are valid for this user
                         const validIds = activeSiteIds.filter(id => userData.siteIds.includes(id));
                         
                         if (validIds.length === 0) {
                             // Default to their first available site if selection is invalid
                             if(mounted) setActiveSiteIds([userData.siteIds[0]]);
                         } else if (validIds.length !== activeSiteIds.length) {
                             // Update to only valid ones
                             if(mounted) setActiveSiteIds(validIds);
                         }
                     } else {
                         // No access to any sites
                         if(mounted) setActiveSiteIds([]); 
                     }
                }

                if (userData.status === 'APPROVED') {
                    // Use silent reload if triggered from silent auth check
                    reloadData(silent);
                    logAction('USER_LOGIN', { email: userData.email, userId: userData.id });
                } else {
                    logAction('USER_LOGIN_PENDING_APPROVAL', { email: userData.email, userId: userData.id });
                }
            }
        } catch (err) {
            console.error("Auth: handleUserAuth failed:", err);
            if (mounted) {
                setIsAuthenticated(false);
                setCurrentUser(null);
                logAction('AUTH_FAILED', { email: session.user.email, error: (err as Error).message });
            }
        } finally {
            isAuthProcessingRef.current = false;
            if (mounted && !silent) setIsLoadingAuth(false);
        }
    };

    const authPromise = initializeAuth();

    // --- Session Keep-Alive & Visibility Handler ---
    const handleVisibilityChange = async () => {
        if ((document.visibilityState === 'visible' || document.hasFocus()) && mounted) {
            if (isCheckingSessionRef.current) return;
            
            try {
                isCheckingSessionRef.current = true;
                const now = Date.now();
                if (currentUser && (now - lastFetchTime.current < 5 * 60 * 1000)) {
                    console.log("Auth: App focused/visible, data is fresh. Skipping checks.");
                    return;
                }

                console.log("Auth: App focused/visible, checking session...");
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session) {
                     if (!currentUser || session.user.email !== currentUser.email) {
                         await handleUserAuth(session, true); 
                     } else {
                         await handleUserAuth(session, true);
                     }
                } else {
                     if (mounted && isLoadingAuth) setIsLoadingAuth(false);
                }
            } catch (e) {
                console.error("Visibility check failed", e);
            } finally {
                isCheckingSessionRef.current = false;
            }
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    globalThis.addEventListener('focus', handleVisibilityChange);
    
    // Passive Keep-Alive Ping (Every 9 minutes)
    const keepAliveInterval = setInterval(async () => {
            if (mounted && !document.hidden) {
                console.log("Auth: Keep-alive ping...");
                await supabase.auth.getSession(); 
            }
    }, 9 * 60 * 1000);

    return () => {
        mounted = false;
        clearTimeout(safetyTimeout);
        clearInterval(keepAliveInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        globalThis.removeEventListener('focus', handleVisibilityChange);
        if (typeof authPromise === 'function') authPromise();
    };
  }, []); // Eslint might warn about reloadData dependency, but we want this to run once on mount.

  // Apply Theme & Branding to DOM
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    const root = globalThis.document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
      const root = globalThis.document.documentElement;
      
      // Font Handling
      if (branding.fontFamily === 'serif') root.style.setProperty('--font-family', 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif');
      else if (branding.fontFamily === 'mono') root.style.setProperty('--font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace');
      else root.style.setProperty('--font-family', 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif');

      // Color Handling
      root.style.setProperty('--color-brand', branding.primaryColor);
      root.style.setProperty('--color-brand-rgb', hexToRgb(branding.primaryColor));
      
      // Optional: If we want to use secondary color in CSS vars later
      root.style.setProperty('--color-secondary', branding.secondaryColor);
      root.style.setProperty('--color-secondary-rgb', hexToRgb(branding.secondaryColor));

      localStorage.setItem('app-branding', JSON.stringify(branding));

      // --- Dynamic Manifest & Favicon Injection ---
      // 1. Favicon
      const linkFavicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      linkFavicon.type = 'image/x-icon';
      linkFavicon.rel = 'icon';
      linkFavicon.href = branding.logoUrl;
      document.getElementsByTagName('head')[0].appendChild(linkFavicon);

      // 2. Apple Touch Icon
      const linkApple = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement || document.createElement('link');
      linkApple.rel = 'apple-touch-icon';
      linkApple.href = branding.logoUrl;
      document.getElementsByTagName('head')[0].appendChild(linkApple);

      // 3. Meta Theme Color
      const metaTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement || document.createElement('meta');
      metaTheme.name = 'theme-color';
      metaTheme.content = branding.primaryColor;
      document.getElementsByTagName('head')[0].appendChild(metaTheme);

      // 4. Dynamic Manifest
      const manifest = {
          name: branding.appName,
          short_name: branding.appName.length > 12 ? branding.appName.substring(0, 12) : branding.appName,
          start_url: ".",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: branding.primaryColor,
          orientation: "portrait",
          icons: [
              {
                  src: branding.logoUrl,
                  sizes: "192x192", // We assume the logo url provided scales or is vector, or browsers handle resize
                  type: "image/png"
              },
              {
                  src: branding.logoUrl,
                  sizes: "512x512",
                  type: "image/png"
              }
          ]
      };
      
      const stringManifest = JSON.stringify(manifest);
      const blob = new Blob([stringManifest], {type: 'application/json'});
      const manifestURL = URL.createObjectURL(blob);
      
      const linkManifest = document.querySelector("link[rel='manifest']") as HTMLLinkElement || document.createElement('link');
      linkManifest.rel = 'manifest';
      linkManifest.href = manifestURL;
      document.getElementsByTagName('head')[0].appendChild(linkManifest);

  }, [branding]);

  // authConfig removed - managed via backend

  // Helper to get RGB string for opacity support
  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '37, 99, 235';
  }

  const updateBranding = async (newBranding: AppBranding) => {
      setBranding(newBranding);
      try {
          await db.updateBranding(newBranding);
          logAction('BRANDING_UPDATED', { primaryColor: newBranding.primaryColor, appName: newBranding.appName });
      } catch (e) {
          console.error("Failed to persist branding", e);
      }
  };

  // --- Auth Operations ---
  const login = async () => {
      if (qaMode) {
          setCurrentUser(qaUser);
          setIsAuthenticated(true);
          setIsPendingApproval(false);
          setIsLoadingAuth(false);
          reloadData(true);
          return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: {
              scopes: 'openid profile email User.Read User.ReadBasic.All Mail.Send offline_access',
              redirectTo: globalThis.location.origin
          }
      });
      if (error) {
          console.error("Login failed:", error.message);
          alert(`Login failed: ${error.message}`);
          logAction('LOGIN_INITIATE_FAILED', { error: error.message });
      } else {
          logAction('LOGIN_INITIATED', { provider: 'azure' });
      }
  };

  const sendWelcomeEmail = async (toEmail: string, name: string, siteIdOverride?: string): Promise<boolean> => {
       try {
          const svc = new DirectoryService(supabase);
          

          const siteId = siteIdOverride || activeSiteIds[0] || currentUser?.siteIds?.[0] || '';
          const invitedByName = currentUser?.name || 'Admin';
          
          const emailSent = await svc.sendMail({
              to: toEmail,
              from: branding.emailTemplate?.fromEmail || currentUser?.email || '',
              subject: branding.emailTemplate?.subject ? 
                  branding.emailTemplate.subject.replace(/{name}/g, name).replace(/{app_name}/g, branding.appName).replace(/{invited_by_name}/g, invitedByName) 
                  : `Welcome to ${branding.appName}`,
              html: branding.emailTemplate?.body ? 
                  branding.emailTemplate.body.replace(/{name}/g, name).replace(/{app_name}/g, branding.appName).replace(/{invited_by_name}/g, invitedByName) 
                  : `
                    <p>Hi ${name},</p>
                    <p>You have been invited to join <strong>${branding.appName}</strong> by ${invitedByName}.</p>
                    <p>Please click the link below to get started:</p>
                    <p>{link}</p>
                    <p>Best regards,<br/>The Admin Team</p>
                  `,
              siteId,
              invitedByName
          });
          if (emailSent) {
              logAction('WELCOME_EMAIL_SENT', { toEmail, name, siteId });
          } else {
              logAction('WELCOME_EMAIL_FAILED', { toEmail, name, siteId, reason: 'Service returned false' });
          }
          return emailSent;
      } catch (e: unknown) {
          console.error("Failed to send welcome email", e);
          // siteId might not be defined if error happened before it was set, but we can try to recalculate or define it outside
          // To be safe, let's use a safe fallback or define it outside try block.
          // Ideally we lift definition out. 
           logAction('WELCOME_EMAIL_FAILED', { toEmail, name, error: (e as Error).message });
          return false;
      }
  };

  const logout = async () => {
      if (qaMode) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          return;
      }
      await supabase.auth.signOut();
  };

  // --- Security Operations ---
  
  const hasPermission = (permissionId: PermissionId): boolean => {
      if (!currentUser) return false;
      // Admins have all permissions implicitly (safe fallback)
      if (currentUser.role === 'ADMIN') return true;
      
      const roleDef = roles.find(r => r.id === currentUser.role);
      return roleDef ? roleDef.permissions.includes(permissionId) : false;
  };

  const createRole = async (role: RoleDefinition) => {
    setRoles(prev => [...prev, role]);
    try {
        await db.upsertRole(role);
        logAction('ROLE_CREATED', { roleId: role.id, roleName: role.name });
    } catch (e) {
        console.error("Failed to create role", e);
        reloadData();
        logAction('ROLE_CREATE_FAILED', { roleId: role.id, error: (e as Error).message });
    }
  };

  const updateRole = async (role: RoleDefinition) => {
    setRoles(prev => prev.map(r => r.id === role.id ? role : r));
    try {
        await db.upsertRole(role);
        logAction('ROLE_UPDATED', { roleId: role.id, roleName: role.name });
    } catch (e) {
        console.error("Failed to update role", e);
        reloadData();
        logAction('ROLE_UPDATE_FAILED', { roleId: role.id, error: (e as Error).message });
    }
  };

  const deleteRole = async (roleId: string) => {
      const role = roles.find(r => r.id === roleId);
      if(role?.isSystem) return; // Prevent deleting system roles
      setRoles(prev => prev.filter(r => r.id !== roleId));
      try {
          await db.deleteRole(roleId);
          logAction('ROLE_DELETED', { roleId });
      } catch (e) {
          console.error("Failed to delete role", e);
          reloadData();
          logAction('ROLE_DELETE_FAILED', { roleId, error: (e as Error).message });
      }
  };
  
  const updateTeamsWebhook = async (url: string) => {
      setTeamsWebhookUrl(url);
      try {
          await db.updateTeamsConfig(url);
          logAction('TEAMS_WEBHOOK_UPDATED', { url: url ? 'configured' : 'removed' });
      } catch (e) {
          console.error("Failed to update teams config", e);
          reloadData();
          logAction('TEAMS_WEBHOOK_UPDATE_FAILED', { error: (e as Error).message });
      }
  };

  const updateProfile = async (updates: Partial<User>) => {
      if (!currentUser) return;
      try {
          const { error } = await supabase
              .from('users')
              .update({
                  name: updates.name,
                  avatar: updates.avatar,
                  job_title: updates.jobTitle,
                  department: updates.department,
                  approval_reason: updates.approvalReason
              })
              .eq('id', currentUser.id);

          if (error) throw error;

          setCurrentUser(prev => prev ? ({ ...prev, ...updates }) : null);
          setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, ...updates } : u));
          logAction('USER_PROFILE_UPDATED', { userId: currentUser.id, email: currentUser.email, updates: Object.keys(updates) });
      } catch (e) {
          console.error("Failed to update profile:", e);
          logAction('USER_PROFILE_UPDATE_FAILED', { userId: currentUser.id, email: currentUser.email, error: (e as Error).message });
          throw e;
      }
  };

  const switchRole = (roleId: UserRole) => {
      if (!currentUser) return;
      // Note: This is a session switch if they have the right realRole
      setCurrentUser(prev => prev ? ({ ...prev, role: roleId }) : null);
      logAction('USER_ROLE_SWITCHED', { userId: currentUser.id, email: currentUser.email, newRole: roleId, oldRole: currentUser.role });
  };

  const updateUserRole = (userId: string, role: UserRole) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      if (currentUser?.id === userId) {
          setCurrentUser(prev => prev ? ({ ...prev, role }) : null);
      }
      // Persistence handled by updateUserAccess for full updates
      const user = users.find(u => u.id === userId);
      if (user && user.role !== role) {
          logAction('USER_ROLE_UPDATED', { userId, email: user.email, oldRole: user.role, newRole: role });
      }
  };

  const updateUserAccess = async (userId: string, role: UserRole, siteIds: string[]) => {
      const user = users.find(u => u.id === userId);
      if(!user) return;
      
      const updatedUser = { ...user, role, siteIds };
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      
      if (currentUser?.id === userId) {
          setCurrentUser(prev => prev ? ({ ...prev, role, siteIds }) : null);
      }

      try {
          await db.upsertUser(updatedUser);
          logAction('USER_ACCESS_UPDATED', { userId, email: user.email, role, siteIds });
      } catch (e) {
          console.error("Failed to update user access", e);
          reloadData();
          logAction('USER_ACCESS_UPDATE_FAILED', { userId, email: user.email, error: (e as Error).message });
      }
  };

  const addUser = async (user: User, shouldSendInvite: boolean = false) => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7); // Aligned to 7 days
      const normalizedEmail = user.email?.toLowerCase();
      let userWithExpiry = { ...user, email: normalizedEmail, invitationExpiresAt: expiry.toISOString() };
      
      if (shouldSendInvite && normalizedEmail) {
          try {
              // Pass the user's primary siteId if available
              const emailSent = await sendWelcomeEmail(normalizedEmail, user.name || 'User', user.siteIds?.[0]);
              if (emailSent) {
                  userWithExpiry = { ...userWithExpiry, invitedAt: new Date().toISOString() };
              }
          } catch (e) {
              console.error("Failed to make invite email request", e);
          }
      }

      // Check if user with this email already exists (handles re-inviting deleted users)
      const existingUser = users.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
      
      if (existingUser) {
          // Update existing user instead of creating new
          const updatedUser = { ...existingUser, ...userWithExpiry, id: existingUser.id };
          setUsers(prev => prev.map(u => u.id === existingUser.id ? updatedUser : u));
          try {
              await db.createOrUpdateUserByEmail(updatedUser);
              logAction('USER_UPDATED_VIA_ADD', { userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role, status: updatedUser.status });
          } catch (e) {
              console.error("Failed to update existing user", e);
              reloadData();
              logAction('USER_UPDATE_VIA_ADD_FAILED', { userId: updatedUser.id, email: updatedUser.email, error: (e as Error).message });
              throw e;
          }
      } else {
          // New user - add to list
          setUsers(prev => [...prev, userWithExpiry]);
          try {
              await db.createOrUpdateUserByEmail(userWithExpiry);
              logAction('USER_CREATED', { userId: userWithExpiry.id, email: userWithExpiry.email, role: userWithExpiry.role, siteIds: userWithExpiry.siteIds });
          } catch (e) {
              console.error("Failed to add user", e);
              reloadData();
              logAction('USER_CREATE_FAILED', { email: userWithExpiry.email, error: (e as Error).message });
              throw e;
          }
      }
  };

  const resendWelcomeEmail = async (email: string, name: string, siteId?: string): Promise<boolean> => {
    try {
      setIsLoadingData(true);
      
      const success = await sendWelcomeEmail(email, name, siteId);
      
      if (success) {
          // Reload all data to refresh invitation status and expiry
          await reloadData();
          logAction('WELCOME_EMAIL_RESENT', { toEmail: email, name, siteId });
      }
      return success;
    } catch (e) {
      console.error("Resend failed", e);
      logAction('WELCOME_EMAIL_RESEND_FAILED', { toEmail: email, name, siteId, error: (e as Error).message });
      return false;
    } finally {
      setIsLoadingData(false);
    }
  };

  const archiveUser = async (userId: string) => {
      // Optimistic update
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'ARCHIVED' } : u));
      try {
          await db.updateUserStatus(userId, 'ARCHIVED');
          logAction('USER_ARCHIVED', { userId });
      } catch (e) {
          console.error("Failed to archive user", e);
          reloadData();
          logAction('USER_ARCHIVE_FAILED', { userId, error: (e as Error).message });
      }
  };

  // --- CRUD Operations ---

  // --- Workflow Operations ---
  const updateWorkflowStep = async (step: WorkflowStep) => {
      // Optimistic update
      setWorkflowSteps(prev => prev.map(s => s.id === step.id ? step : s));
      try {
          await db.upsertWorkflowStep(step);
          logAction('WORKFLOW_STEP_UPDATED', { stepId: step.id, name: step.stepName });
      } catch (e) {
          console.error("Failed to update workflow step", e);
          reloadData(); // Revert
          logAction('WORKFLOW_STEP_UPDATE_FAILED', { stepId: step.id, error: (e as Error).message });
      }
  };

  const addWorkflowStep = async (step: WorkflowStep) => {
      setWorkflowSteps(prev => [...prev, step]);
      try {
          await db.upsertWorkflowStep(step);
          logAction('WORKFLOW_STEP_ADDED', { stepId: step.id, name: step.stepName });
      } catch (e) {
          console.error("Failed to add workflow step", e);
          reloadData();
          logAction('WORKFLOW_STEP_ADD_FAILED', { stepId: step.id, error: (e as Error).message });
      }
  };

  const deleteWorkflowStep = async (id: string) => {
      setWorkflowSteps(prev => prev.filter(s => s.id !== id));
      try {
          await db.deleteWorkflowStep(id);
          logAction('WORKFLOW_STEP_DELETED', { stepId: id });
      } catch (e) {
         console.error("Failed to delete workflow step", e);
         reloadData();
         logAction('WORKFLOW_STEP_DELETE_FAILED', { stepId: id, error: (e as Error).message });
      }
  };

  // --- Notification Operations ---
  // --- Notification Operations ---
  const upsertNotificationRule = async (rule: NotificationRule) => {
      setNotificationRules(prev => {
          const exists = prev.find(n => n.id === rule.id);
          return exists ? prev.map(n => n.id === rule.id ? rule : n) : [...prev, rule];
      });
      try {
          await db.upsertNotificationRule(rule);
          logAction('NOTIFICATION_RULE_UPSERTED', { ruleId: rule.id, eventType: rule.eventType, isActive: rule.isActive });
      } catch (e) {
          console.error("Failed to upsert notification rule", e);
          reloadData();
          logAction('NOTIFICATION_RULE_UPSERT_FAILED', { ruleId: rule.id, error: (e as Error).message });
      }
  };

  const deleteNotificationRule = async (id: string) => {
      setNotificationRules(prev => prev.filter(n => n.id !== id));
      try {
          await db.deleteNotificationRule(id);
          logAction('NOTIFICATION_RULE_DELETED', { ruleId: id });
      } catch (e) {
           console.error("Failed to delete notification rule", e);
           reloadData();
           logAction('NOTIFICATION_RULE_DELETE_FAILED', { ruleId: id, error: (e as Error).message });
      }
  };
  
    const sendNotification = async (event: NotificationEventType, data: unknown) => {
        // 1. Get Matching Rules
        const rules = notificationRules.filter(r => r.eventType === event && r.isActive);
        if (rules.length === 0) return;

        console.log(`Processing ${rules.length} rules for ${event}`);

        // 2. Targets Map
        const targets = new Map<string, { 
            userId?: string, 
            emailAddress?: string, 
            email: boolean, 
            inApp: boolean, 
            teams: boolean 
        }>();

        const mergeTarget = (key: string, userData: Record<string, unknown>, channels: { email: boolean; inApp: boolean; teams: boolean }) => {
            const existing = targets.get(key) || { userId: userData.userId as string | undefined, emailAddress: userData.emailAddress as string | undefined, email: false, inApp: false, teams: false };
            targets.set(key, {
                userId: existing.userId,
                emailAddress: existing.emailAddress,
                email: existing.email || channels.email,
                inApp: existing.inApp || channels.inApp,
                teams: existing.teams || channels.teams
            });
        };

        for (const rule of rules) {
            for (const recipient of rule.recipients) {
                if (recipient.type === 'USER') {
                     mergeTarget(recipient.id, { userId: recipient.id }, recipient.channels);
                } else if (recipient.type === 'ROLE') {
                     const roleUsers = users.filter(u => u.role === recipient.id || u.realRole === recipient.id);
                     roleUsers.forEach(u => mergeTarget(u.id, { userId: u.id, emailAddress: u.email }, recipient.channels));
                } else if (recipient.type === 'REQUESTER') {
                     if ((data as { requesterId?: string }).requesterId) {
                        const reqUser = users.find(u => u.id === (data as { requesterId: string }).requesterId);
                        if (reqUser) mergeTarget(reqUser.id, { userId: reqUser.id, emailAddress: reqUser.email }, recipient.channels);
                     }
                } else if (recipient.type === 'EMAIL') {
                     if (recipient.id.includes('@')) {
                         mergeTarget(`email:${recipient.id}`, { emailAddress: recipient.id }, recipient.channels);
                     }
                }
            }
        }

        // 3. Dispatch
        // Teams (Global Check)
        const sendTeams = Array.from(targets.values()).some(t => t.teams);
        if (sendTeams && teamsWebhookUrl) {
             const message = `**ProcureFlow Notification**\n\nEvent: ${event}\nData: ${JSON.stringify(data, null, 2)}`;
             try {
                await fetch(teamsWebhookUrl, { method: 'POST', body: JSON.stringify({ text: message }) });
                logAction('NOTIFICATION_SENT_TEAMS', { event, data });
             } catch (e) {
                 console.error("Failed to send Teams webhook", e);
                 logAction('NOTIFICATION_TEAMS_FAILED', { event, data, error: (e as Error).message });
             }
        }

        // Individual Targets
        for (const [, target] of targets.entries()) {
            if (target.inApp && target.userId) {
                try {
                    await db.addNotification({
                        userId: target.userId,
                        title: event,
                        message: JSON.stringify(data),
                        link: ''
                    });
                    logAction('NOTIFICATION_SENT_INAPP', { event, userId: target.userId, data });
                } catch (e) { 
                    console.error("Failed to add in-app notification", e); 
                    logAction('NOTIFICATION_INAPP_FAILED', { event, userId: target.userId, error: (e as Error).message });
                }
            }
            
            if (target.email && target.emailAddress) {
                 // Updated to use DirectoryService for notifications
                 try {
                     const svc = new DirectoryService(supabase);
                     const siteId = activeSiteIds[0] || currentUser?.siteIds?.[0] || '';
                     
                     await svc.sendMail({
                         to: target.emailAddress,
                         from: currentUser?.email || '',
                         subject: `ProcureFlow Notification: ${event}`,
                         html: `<p>Event: ${event}</p><p>Details:</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
                         siteId,
                         invitedByName: 'System Notification'
                     });
                     logAction('NOTIFICATION_SENT_EMAIL', { event, toEmail: target.emailAddress, data });
                 } catch (e) {
                     console.error("Failed to send notification email", e);
                     logAction('NOTIFICATION_EMAIL_FAILED', { event, toEmail: target.emailAddress, error: (e as Error).message });
                 }
                 // Removed USE_GRAPH_DELEGATED check as we use System Sender now

            }
        }
    };

  const createPO = async (po: PORequest) => {
    try {
        const displayId = await db.createPO(po);
        // NOTIFICATION TRIGGER
        sendNotification('PO_CREATED', { poId: displayId, requesterId: po.requesterId, amount: po.totalAmount });
        logAction('PO_CREATED', { id: displayId, amount: po.totalAmount }, { requester: po.requesterName });
        setPos(prev => [{ ...po, displayId }, ...prev]);
    } catch (error) {
        console.error('Failed to create PO:', error);
        alert('Failed to create PO order.');
        logAction('PO_CREATE_FAILED', { requesterId: po.requesterId, error: (error as Error).message });
    }
  };

  const updatePendingPO = async (
      poId: string,
      updates: {
          customerName?: string;
          reasonForRequest?: 'Depletion' | 'New Customer' | 'Other';
          comments?: string;
          lines: POLineItem[];
      }
  ) => {
      if (!currentUser) throw new Error('You must be signed in to edit a request.');

      const existing = pos.find(p => p.id === poId);
      if (!existing) throw new Error('Request not found.');

      const canEdit =
          existing.status === 'PENDING_APPROVAL' &&
          (currentUser.role === 'ADMIN' || existing.requesterId === currentUser.id);

      if (!canEdit) {
          throw new Error('Only the requester can edit while the request is pending approval.');
      }

      const normalizedLines = (updates.lines || []).map(line => {
          const quantityOrdered = Math.max(1, Math.floor(Number(line.quantityOrdered) || 0));
          const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
          return {
              ...line,
              quantityOrdered,
              unitPrice,
              totalPrice: Number((quantityOrdered * unitPrice).toFixed(2))
          };
      });

      if (normalizedLines.length === 0) {
          throw new Error('At least one line item is required.');
      }

      const totalAmount = Number(
          normalizedLines.reduce((sum, line) => sum + line.totalPrice, 0).toFixed(2)
      );

      try {
          await db.updatePendingPO(poId, {
              requesterId: currentUser.role === 'ADMIN' ? undefined : currentUser.id,
              customerName: updates.customerName,
              reasonForRequest: updates.reasonForRequest,
              comments: updates.comments,
              lines: normalizedLines
          });

          setPos(prev => prev.map(p => {
              if (p.id !== poId) return p;
              return {
                  ...p,
                  customerName: updates.customerName,
                  reasonForRequest: updates.reasonForRequest,
                  comments: updates.comments,
                  lines: normalizedLines,
                  totalAmount
              };
          }));

          logAction(
              'PO_UPDATED',
              { poId, lineCount: normalizedLines.length, totalAmount },
              { status: existing.status, requesterId: existing.requesterId }
          );
      } catch (e) {
          logAction('PO_UPDATE_FAILED', { poId, error: (e as Error).message });
          throw e;
      }
  };

  const updatePOStatus = async (poId: string, status: POStatus, event: ApprovalEvent) => {
    // Optimistic
    setPos(prev => prev.map(p => p.id === poId ? { ...p, status, approvalHistory: [...p.approvalHistory, event] } : p));
    
    // Persist
    try {
        await db.updatePOStatus(poId, status);
        await db.addPOApproval(poId, event);
        
        // NOTIFICATION TRIGGER
        if (status === 'APPROVED_PENDING_CONCUR') {
            const po = pos.find(p => p.id === poId);
            if (po) sendNotification('PO_APPROVED', { poId: po.displayId || po.id, approver: event.approverName });
            logAction('PO_APPROVED', { id: poId, status });
        } else if (status === 'REJECTED') {
            const po = pos.find(p => p.id === poId);
            if (po) sendNotification('PO_REJECTED', { poId: po.displayId || po.id, rejector: event.approverName });
            logAction('PO_REJECTED', { id: poId, status });
        } else {
             logAction('PO_STATUS_CHANGE', { id: poId, status });
        }
        
    } catch (e) {
        console.error("Failed to update status", e);
        reloadData();
        logAction('PO_STATUS_UPDATE_FAILED', { poId, status, error: (e as Error).message });
    }
  };

  const deletePO = async (id: string) => {
      try {
          const target = pos.find(p => p.id === id);
          if (!target) throw new Error('Request not found.');

          const isAdmin = currentUser?.role === 'ADMIN';
          const isRequesterPending = Boolean(
              currentUser &&
              target.requesterId === currentUser.id &&
              target.status === 'PENDING_APPROVAL'
          );

          if (!isAdmin && !isRequesterPending) {
              throw new Error('Only pending requests can be deleted by the requester.');
          }

          // Optimistic remove
          setPos(prev => prev.filter(p => p.id !== id));
          
          await db.deletePO(id);
          logAction('PO_DELETED', { id });
          // sendNotification('SYSTEM', { message: `PO ${id} deleted by admin` });
      } catch (e) {
          console.error("Failed to delete PO", e);
          alert((e as Error).message || "Failed to delete PO");
          reloadData(); // Revert
          logAction('PO_DELETE_FAILED', { id, error: (e as Error).message });
      }
  };

  const linkConcurPO = async (poId: string, concurPoNumber: string) => {
      if (!concurPoNumber.trim()) {
          alert("Please enter a valid Concur PO number.");
          return;
      }

      // 1. Optimistic Update (Immediate Feedback)
      setPos(prev => prev.map(p => {
          if (p.id !== poId) return p;
          const updatedLines = p.lines.map(l => ({ ...l, concurPoNumber }));
          return { ...p, lines: updatedLines, status: 'ACTIVE' as POStatus };
      }));
      
      try {
          // 2. Locate PO in current state (to get line IDs)
          // Note: We use the existing 'pos' from closure here, but we should verify it has lines.
          const po = pos.find(p => p.id === poId);
          
          if (!po || !po.lines || po.lines.length === 0) {
              console.warn("linkConcurPO: PO or lines not found in state, attempting to proceed via DB if IDs match.");
              // If po is missing from state (unlikely but possible if filter changed), 
              // we can't get line IDs easily without a fresh fetch. 
              // However, the optimistic update already happened, so we can't easily revert without reload.
              throw new Error("PO details not found in current view. Please refresh and try again.");
          }

          // 3. Persist line-level updates
          // We do this sequentially to ensure reliability, though Promise.all is faster.
          for (const line of po.lines) {
              await db.linkConcurPO(line.id, concurPoNumber);
          }

          // 4. Update Header Status
          await db.updatePOStatus(poId, 'ACTIVE'); 
          
          console.log(`Successfully linked Concur PO ${concurPoNumber} to PO ${poId}`);
          logAction('PO_CONCUR_LINKED', { poId, concurPoNumber });
      } catch (e) {
          console.error("Failed to link Concur PO:", e);
          alert(`Failed to link Concur PO: ${e instanceof Error ? e.message : 'Unknown error'}`);
          // Revert state
          reloadData();
          logAction('PO_CONCUR_LINK_FAILED', { poId, concurPoNumber, error: (e as Error).message });
      }
  };

  const addDelivery = async (poId: string, delivery: DeliveryHeader, closedLineIds: string[] = []) => {
    const p = pos.find(req => req.id === poId);
    if (!p) return;

    let varianceTriggered = false;

    const updatedLines = p.lines.map(line => {
      const deliveryLine = delivery.lines.find(dl => dl.poLineId === line.id);
      const newQtyReceived = line.quantityReceived + (deliveryLine?.quantity || 0);
      
      // Check Over-Delivery Variance
      if (newQtyReceived > line.quantityOrdered) {
          varianceTriggered = true;
      }

      // Check Short-Close Variance
      let isForceClosed = line.isForceClosed;
      if (closedLineIds.includes(line.id)) {
          if (newQtyReceived < line.quantityOrdered) {
              varianceTriggered = true;
          }
          isForceClosed = true;
      }

      return deliveryLine || closedLineIds.includes(line.id)
          ? { ...line, quantityReceived: newQtyReceived, isForceClosed } 
          : line;
    });

    // Determine Status
    let newStatus: POStatus = 'PARTIALLY_RECEIVED';
    
    if (varianceTriggered) {
        newStatus = 'VARIANCE_PENDING';
    } else {
        // Standard Calculation
        const allReceived = updatedLines.every(l => l.quantityReceived >= l.quantityOrdered || l.isForceClosed);
        newStatus = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    }

    // Optimistic Update
    setPos(prev => prev.map(req => 
        req.id === poId 
            ? { ...req, lines: updatedLines, deliveries: [...req.deliveries, delivery], status: newStatus } 
            : req
    ));

    // Persist
    try {
        await db.createDelivery(delivery, poId);

        // 1. Update PO Status
        await db.updatePOStatus(poId, newStatus);
        
        // 2. Update PO Lines
        const linesToUpdate = updatedLines
            .filter(l => delivery.lines.some(dl => dl.poLineId === l.id) || closedLineIds.includes(l.id))
            .map(l => ({
                id: l.id,
                po_request_id: poId, // Required for upsert context usually
                quantity_received: l.quantityReceived,
                is_force_closed: l.isForceClosed
            }));
        
        if (linesToUpdate.length > 0) {
            await db.updatePOLines(linesToUpdate);
        }

        // NOTIFICATION TRIGGER
        sendNotification('DELIVERY_RECEIVED', { poId: poId, deliveryId: delivery.id, receivedBy: delivery.receivedBy });
        logAction('DELIVERY_ADDED', { poId, deliveryId: delivery.id, receivedBy: delivery.receivedBy, newStatus });

    } catch (e) {
        console.error("Failed to add delivery", e);
        reloadData();
        logAction('DELIVERY_ADD_FAILED', { poId, deliveryId: delivery.id, error: (e as Error).message });
        throw e;
    }
  };

  const updateFinanceInfo = async (poId: string, deliveryId: string, lineId: string, updates: Partial<DeliveryLineItem>) => {
      // Optimistic Update
      setPos(prev => prev.map(p => {
          if(p.id !== poId) return p;
          const updatedDeliveries = p.deliveries.map(d => {
              if(d.id !== deliveryId) return d;
              const updatedLines = d.lines.map(l => l.id === lineId ? { ...l, ...updates } : l);
              return { ...d, lines: updatedLines };
          });
          return { ...p, deliveries: updatedDeliveries };
      }));

      // Persistence
      try {
          await db.updateDeliveryLineFinanceInfo(lineId, updates);
          logAction('DELIVERY_FINANCE_INFO_UPDATED', { poId, deliveryId, lineId, updates: Object.keys(updates) });
      } catch (error) {
          console.error('Failed to persist finance info:', error);
          alert('Failed to save changes. Please try again.');
          reloadData(); // Revert
          logAction('DELIVERY_FINANCE_INFO_UPDATE_FAILED', { poId, deliveryId, lineId, error: (error as Error).message });
      }
  };

  const addSnapshot = async (snapshot: SupplierStockSnapshot) => {
    try {
        await db.addSnapshot(snapshot);
        setStockSnapshots(prev => [...prev, snapshot]);
        logAction('STOCK_SNAPSHOT_ADDED', { supplierId: snapshot.supplierId, snapshotDate: snapshot.snapshotDate });
    } catch (e: unknown) {
      console.error("Failed to add snapshot", e);
      reloadData();
      alert('Failed to save stock snapshot.');
      logAction('STOCK_SNAPSHOT_ADD_FAILED', { supplierId: snapshot.supplierId, error: (e as Error).message });
    }
  };

  const importStockSnapshot = async (supplierId: string, date: string, snapshots: SupplierStockSnapshot[]): Promise<void> => {
      try {
          await db.importStockSnapshot(supplierId, date, snapshots);
          // 1. Sync items automatically (user request: intelligent integration)
          await db.syncItemsFromSnapshots(supplierId);
          // 2. Reload all snapshots and items to ensure state consistency
          const [refreshedSnapshots, refreshedItems] = await Promise.all([
              db.getStockSnapshots(),
              db.getItems()
          ]);
          setStockSnapshots(refreshedSnapshots);
          setItems(refreshedItems);
          // 3. Update availability
          await refreshAvailability(refreshedSnapshots);
          logAction('STOCK_SNAPSHOT_IMPORTED', { supplierId, date, count: snapshots.length });
      } catch (error) {
          console.error('Failed to import stock:', error);
          logAction('STOCK_SNAPSHOT_IMPORT_FAILED', { supplierId, date, error: (error as Error).message });
          throw error;
      }
  };
  
  const updateCatalogItem = async (newItem: SupplierCatalogItem) => {
    try {
        await db.updateCatalogItem(newItem);
        setCatalog(prev => {
            const exists = prev.find(c => c.id === newItem.id);
            return exists ? prev.map(c => c.id === newItem.id ? newItem : c) : [...prev, newItem];
        });
        logAction('CATALOG_ITEM_UPDATED', { itemId: newItem.id, supplierId: newItem.supplierId });
    } catch (error) {
        console.error('Failed to update catalog:', error);
        alert('Failed to update catalog item.');
        logAction('CATALOG_ITEM_UPDATE_FAILED', { itemId: newItem.id, error: (error as Error).message });
    }
  };

  const getEffectiveStock = (itemId: string, supplierId: string): number => {
      // 1. Find the confirmed mapping
      const mapping = mappings.find(m => m.productId === itemId && m.supplierId === supplierId && m.mappingStatus === 'CONFIRMED');
      if (!mapping) return 0; 
      
      const relevantSnapshots = stockSnapshots
        .filter(s => s.supplierId === supplierId && s.supplierSku === mapping.supplierSku)
        .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());

      if (relevantSnapshots.length === 0) return 0; 
      const latestSnapshot = relevantSnapshots[0];
      
      let pendingDemand = 0;
      pos.forEach(po => {
          if (new Date(po.requestDate) > new Date(latestSnapshot.snapshotDate)) {
             if (['PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'PARTIALLY_RECEIVED'].includes(po.status)) {
                 const demandForItem = po.lines
                     .filter(l => l.itemId === itemId)
                     .reduce((sum, line) => sum + (Number(line.quantityOrdered) || 0), 0);
                 pendingDemand += demandForItem;
             }
          }
      });
      return Math.max(0, latestSnapshot.availableQty - pendingDemand);
  };

  // --- Master & Mapping Logic --
  const runDataBackfill = async () => {
      if (!globalThis.confirm('This will re-calculate and overwrite normalization fields for ALL Items and Snapshots. Continue?')) return;
      try {
          setIsLoadingData(true);
          const res = await db.backfillNormalization();
          alert(`Success! Backfilled ${res.items} items and ${res.snapshots} snapshots.`);
          
          // Reload relevant state
          const [i, s] = await Promise.all([db.getItems(), db.getStockSnapshots()]);
          setItems(i);
          setStockSnapshots(s);
          logAction('DATA_BACKFILL_COMPLETED', { itemsBackfilled: res.items, snapshotsBackfilled: res.snapshots });
      } catch (e: unknown) {
          console.error(e);
          alert('Backfill Failed: ' + (e as Error).message);
          logAction('DATA_BACKFILL_FAILED', { error: (e as Error).message });
      } finally {
          setIsLoadingData(false);
      }
  };

  const refreshAvailability = async (snapshotsOverride?: SupplierStockSnapshot[], mappingsOverride?: SupplierProductMap[]) => {
    try {
        const maps = mappingsOverride || mappings;
        const confirmed = maps.filter(m => m.mappingStatus === 'CONFIRMED');
        const snaps = snapshotsOverride || stockSnapshots;
        const latestStockMap = new Map<string, SupplierStockSnapshot>();
        snaps.forEach(s => {
            const key = `${s.supplierId}:${s.supplierSku}`;
            const existing = latestStockMap.get(key);
            if (!existing || new Date(s.snapshotDate) > new Date(existing.snapshotDate)) {
                latestStockMap.set(key, s);
            }
        });
        
        const newAvailability: ProductAvailability[] = [];
        confirmed.forEach(map => {
            const snapshot = latestStockMap.get(`${map.supplierId}:${map.supplierSku}`);
            if (snapshot) {
                const item = items.find(i => i.id === map.productId);
                if (item) {
                   const availableUnits = snapshot.availableQty * (map.packConversionFactor || 1);
                   const orderMult = item.defaultOrderMultiple || 1;
                   const availableOrderQty = Math.floor(availableUnits / orderMult) * orderMult;
                   
                   newAvailability.push({
                       id: `avail-${item.id}-${map.supplierId}`, 
                       productId: item.id,
                       supplierId: map.supplierId,
                       availableUnits,
                       availableOrderQty,
                       updatedAt: new Date().toISOString()
                   } as ProductAvailability);
                }
            }
        });
        
        // Merge with existing IDs if needed (db upsert handles PK, but here we generate ID based on product+supplier)
        // Actually, if we use a deterministic ID like `avail-prod-supp`, upsert handles it.
        // But UUID is required by schema. `avail-prod-supp` is not valid UUID. 
        // We must fetch existing ID or generate new UUID if not exists.
        // For simplicity in this step, we'll try to match existing in state.
        
        const finalPayload = newAvailability.map(n => {
            const existing = availability.find(a => a.productId === n.productId && a.supplierId === n.supplierId);
            return { ...n, id: existing ? existing.id : crypto.randomUUID() };
        });

        await db.upsertProductAvailability(finalPayload);
        setAvailability(finalPayload); // Ideal: Refetch from DB to get canonical IDs
        logAction('PRODUCT_AVAILABILITY_REFRESHED', { count: finalPayload.length });
    } catch (e) {
        console.error('Failed to refresh availability', e);
        logAction('PRODUCT_AVAILABILITY_REFRESH_FAILED', { error: (e as Error).message });
    }
  };

  const importMasterProducts = async (newItems: Partial<Item>[], archiveMissing: boolean = false) => {
      const result = await db.upsertMasterItemsBulk(newItems, archiveMissing, currentUser?.id);
      const fresh = await db.getItems();
      setItems(fresh);
      logAction('MASTER_PRODUCTS_IMPORTED', { newItemsCount: newItems.length, archivedMissing: archiveMissing, result });
      return result;
  };

  const getMappingQueue = async (supplierId?: string) => {
      return await db.getMappingQueue(supplierId);
  };

  const getItemFieldRegistry = async () => {
      return await db.getItemFieldRegistry();
  };

  const runAutoMapping = async (supplierId: string) => {
      const result = await db.runAutoMapping(supplierId);
      // Immediately sync after auto-mapping for seamless updates
      await db.syncItemsFromSnapshots(supplierId);
      const freshItems = await db.getItems();
      setItems(freshItems);
      await refreshAvailability();
      logAction('AUTO_MAPPING_RUN', { supplierId, result });
      return result;
  };

  const getMappingMemory = async (supplierId?: string) => {
      return await db.getMappingMemory(supplierId);
  };

  const deleteMapping = async (id: string) => {
      await db.deleteMapping(id);
      setMappings(prev => prev.filter(m => m.id !== id));
      await refreshAvailability();
      logAction('MAPPING_DELETED', { mappingId: id });
  };

  const syncItemsFromSnapshots = async (supplierId?: string) => {
      if (!supplierId) {
          // If no supplier provided, sync for all suppliers that have snapshots
          const suppliers = await db.getSuppliers();
          let totalUpdated = 0;
          for (const s of suppliers) {
              const res = await db.syncItemsFromSnapshots(s.id);
              totalUpdated += res.updated;
          }
          const freshItems = await db.getItems();
          setItems(freshItems);
          logAction('ITEMS_SYNCED_FROM_SNAPSHOTS_ALL', { totalUpdated });
          return { updated: totalUpdated };
      }
      const res = await db.syncItemsFromSnapshots(supplierId);
      const freshItems = await db.getItems();
      setItems(freshItems);
      logAction('ITEMS_SYNCED_FROM_SNAPSHOTS', { supplierId, updated: res.updated });
      return res;
  };

  const getAuditLogs = async (filters?: { startDate?: string, endDate?: string, userId?: string, actionType?: string }) => {
    return await db.getAuditLogs(filters);
  };

  const logAction = async (actionType: string, summary: Record<string, unknown>, details: Record<string, unknown> = {}) => {
      if (!currentUser) return;
      try {
          await db.createAuditLog({
              actionType,
              performedBy: currentUser.id,
              summary,
              details
          });
      } catch (e) {
          console.error("Failed to log action", e);
          // Non-blocking
      }
  };


  
  const generateMappings = async () => {
       console.warn('generateMappings is deprecated. Use runAutoMapping(supplierId)');
       const suppliers = await db.getSuppliers();
       for (const sup of suppliers) {
           await db.runAutoMapping(sup.id);
       }
       await refreshAvailability();
       logAction('GENERATE_MAPPINGS_DEPRECATED_CALL', { message: 'Called deprecated function' });
  };

  const upsertMapping = async (mapping: SupplierProductMap) => {
        await db.upsertMapping(mapping);
        // Optimistic update
        setMappings(prev => {
             const exists = prev.find(m => m.id === mapping.id);
             return exists ? prev.map(m => m.id === mapping.id ? mapping : m) : [...prev, mapping];
        });
        await refreshAvailability(undefined, [...mappings.filter(m => m.id !== mapping.id), mapping]);
        logAction('MAPPING_UPSERTED', { mappingId: mapping.id, productId: mapping.productId, supplierId: mapping.supplierId, status: mapping.mappingStatus });
  };

  const addItem = async (item: Item) => {
        try {
            await db.addItem(item);
            setItems(prev => [...prev, item]);
            logAction('ITEM_ADDED', { itemId: item.id, name: item.name });
        } catch (e) {
            console.error("AppContext: Failed to add item", e);
            alert("Failed to add item. Check console for details.");
            logAction('ITEM_ADD_FAILED', { name: item.name, error: (e as Error).message });
            throw e;
        }
  };
  const updateItem = async (item: Item) => {
        try {
            await db.updateItem(item);
            setItems(prev => prev.map(i => i.id === item.id ? item : i));
            logAction('ITEM_UPDATED', { itemId: item.id, name: item.name });
        } catch (e) {
             console.error("AppContext: Failed to update item", e);
             alert("Failed to update item. Check console for details.");
             logAction('ITEM_UPDATE_FAILED', { itemId: item.id, error: (e as Error).message });
             throw e;
        }
  };
  const deleteItem = async (itemId: string) => {
        try {
            await db.deleteItem(itemId);
            setItems(prev => prev.filter(i => i.id !== itemId));
            logAction('ITEM_DELETED', { itemId });
        } catch (e) {
             console.error(e);
             alert("Failed to delete item");
             logAction('ITEM_DELETE_FAILED', { itemId, error: (e as Error).message });
        }
  };

  const archiveItem = async (itemId: string) => {
        try {
            await db.archiveItem(itemId);
            setItems(prev => prev.map(i => i.id === itemId ? { ...i, activeFlag: false } : i));
            logAction('ITEM_ARCHIVED', { itemId });
        } catch (e) {
             console.error(e);
             alert("Failed to archive item");
             logAction('ITEM_ARCHIVE_FAILED', { itemId, error: (e as Error).message });
        }
  };

  const addSupplier = async (s: Supplier) => {
        try {
            await db.addSupplier(s);
            setSuppliers(prev => [...prev, s]);
        } catch (e) {
             console.error(e);
             alert("Failed to add supplier");
        }
  };
  const updateSupplier = async (s: Supplier) => {
        try {
            await db.updateSupplier(s);
            setSuppliers(prev => prev.map(existing => existing.id === s.id ? s : existing));
        } catch (e) {
             console.error(e);
             alert("Failed to update supplier");
        }
  };
  const deleteSupplier = async (id: string) => {
        try {
            await db.deleteSupplier(id);
            setSuppliers(prev => prev.filter(s => s.id !== id));
        } catch (e) {
             console.error(e);
             alert("Failed to delete supplier");
        }
  };

  const addSite = async (s: Site) => {
        try {
            await db.addSite(s);
            setSites(prev => [...prev, s]);
        } catch (e) {
             console.error(e);
             alert("Failed to add site");
        }
  };
  const updateSite = async (s: Site) => {
        try {
            await db.updateSite(s);
            setSites(prev => prev.map(existing => existing.id === s.id ? s : existing));
        } catch (e) {
             console.error(e);
             alert("Failed to update site");
        }
  };
  const deleteSite = async (id: string) => {
        try {
            await db.deleteSite(id);
            setSites(prev => prev.filter(s => s.id !== id));
        } catch (e) {
             console.error(e);
             alert("Failed to delete site");
        }
  };


    // --- Catalog Management ---
    const getAttributeOptions = async (type?: string) => {
        try {
            const options = await db.getAttributeOptions(type);
             // If fetching all, update global state
            if (!type) {
                setAttributeOptions(options);
            }
            return options;
        } catch (e) {
            console.error(e);
            return [];
        }
    };

    const upsertAttributeOption = async (option: Partial<AttributeOption>) => {
        try {
            await db.upsertAttributeOption(option);
            // Refresh local state
            const updated = await db.getAttributeOptions();
            setAttributeOptions(updated);
        } catch (e) {
            console.error('Failed to save attribute option:', e);
            throw e; // Re-throw so the UI can show a specific error
        }
    };

    const deleteAttributeOption = async (id: string) => {
        try {
            await db.deleteAttributeOption(id);
             // Refresh local state
             setAttributeOptions(prev => prev.filter(o => o.id !== id));
        } catch (e) {
            console.error(e);
            alert("Failed to delete attribute option");
        }
    };



  // --- Context Value Memoization ---
  const contextValue = React.useMemo(() => ({
    currentUser, isAuthenticated, activeSiteIds, setActiveSiteIds, siteName, login, logout, isLoadingAuth, isPendingApproval, isLoadingData,
    users, updateUserRole, updateUserAccess, addUser, archiveUser, reloadData,
    roles, permissions: [], hasPermission, createRole, updateRole, deleteRole,
    teamsWebhookUrl, updateTeamsWebhook,
    pos: filteredPos, allPos: pos, // Expose filtered POs as default, raw as allPos 
    suppliers, items, sites, userSites, catalog, stockSnapshots,
    mappings, availability, attributeOptions,
    
    // Methods
    importMasterProducts, generateMappings, updateMapping: upsertMapping, refreshAvailability, runDataBackfill,
    workflowSteps, updateWorkflowStep, addWorkflowStep, deleteWorkflowStep,
    notificationRules, upsertNotificationRule, deleteNotificationRule,
    theme, setTheme, branding, updateBranding,
    createPO, updatePendingPO, updatePOStatus, linkConcurPO, addDelivery, updateFinanceInfo,
    updateProfile, switchRole,
    addSnapshot, importStockSnapshot, updateCatalogItem, upsertProductMaster: importMasterProducts,
    getAttributeOptions, upsertAttributeOption, deleteAttributeOption,
    getEffectiveStock,
    addItem, updateItem, deleteItem, archiveItem,
    addSupplier, updateSupplier, deleteSupplier,
    addSite, updateSite, deleteSite,
    
    // New Admin Caps
    getItemFieldRegistry,
    runAutoMapping,
    getMappingQueue,
    getMappingMemory,
    deleteMapping,
    syncItemsFromSnapshots,
    getAuditLogs,
    logAction,
    resendWelcomeEmail,
    sendWelcomeEmail,

    getDirectoryService: () => {
        return Promise.resolve(new DirectoryService(supabase));
    },

    searchDirectory: async (query: string, siteIdOverride?: string) => {
        // Updated to use DirectoryService (Edge Function)
        const activeSiteId = activeSiteIds[0];
        // Logic: Search should be scoped to current context if possible.
        const siteId = siteIdOverride || activeSiteId || currentUser?.siteIds?.[0] || 'global';
        
        const svc = new DirectoryService(supabase);
        return await svc.searchDirectory(query, siteId);
    },
    sendNotification,
    deletePO
  }), [
    currentUser, isAuthenticated, activeSiteIds, isLoadingAuth, isPendingApproval, isLoadingData,
    users, roles, teamsWebhookUrl, theme, branding,
    filteredPos, pos, suppliers, items, sites, catalog, stockSnapshots, mappings, availability, attributeOptions,
    workflowSteps, notificationRules,
    reloadData, siteName
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
