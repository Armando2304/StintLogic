import { Session, Driver, Lap, CarData, LocationData } from '../types';

const BASE_URL = 'https://api.openf1.org/v1';

// --- CACHING SYSTEM ---
const MAX_CACHE_SIZE = 50; // Maximum number of requests to cache
const responseCache = new Map<string, any>();

// --- QUEUE SYSTEM ---
// Simplified Promise chaining queue
let queuePromise: Promise<void> = Promise.resolve();
const MIN_REQUEST_DELAY = 250; 

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const enqueueRequest = <T>(task: () => Promise<T>): Promise<T> => {
    // Chain requests to the previous promise
    const nextRequest = queuePromise.then(async () => {
        await delay(MIN_REQUEST_DELAY); // Rate limiting pause
        return task();
    });

    // Update the tail of the queue, catching errors so the queue doesn't stall on failure
    queuePromise = nextRequest.then(() => {}).catch(() => {});
    
    return nextRequest;
};

// Helper to handle API rate limits, caching, and json parsing with retry logic
const fetchFromOpenF1 = async (endpoint: string, params: Record<string, string | number>, useCache = true) => {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.keys(params).forEach(key => url.searchParams.append(key, String(params[key])));
  const urlString = url.toString();

  // 1. Check Cache
  if (useCache && responseCache.has(urlString)) {
      return responseCache.get(urlString);
  }

  // 2. Queue the fetch
  return enqueueRequest(async () => {
      let attempts = 0;
      const maxRetries = 4;
      let retryDelay = 2000;

      while (attempts < maxRetries) {
          try {
              const response = await fetch(urlString);

              if (response.status === 429) {
                  throw new Error("429");
              }

              if (!response.ok) {
                  throw new Error(`OpenF1 API Error: ${response.statusText}`);
              }

              const json = await response.json();

              if (Array.isArray(json)) {
                  if (useCache) {
                      // Simple memory management
                      if (responseCache.size >= MAX_CACHE_SIZE) {
                          // Delete the first key (oldest inserted)
                          const firstKey = responseCache.keys().next().value;
                          if (firstKey) responseCache.delete(firstKey);
                      }
                      responseCache.set(urlString, json);
                  }
                  return json;
              } else {
                  console.warn(`OpenF1 API returned non-array for ${endpoint}:`, json);
                  return [];
              }

          } catch (error: any) {
              if (error.message.includes("429")) {
                  attempts++;
                  if (attempts >= maxRetries) {
                      console.error(`OpenF1 Rate Limit exceeded: ${urlString}`);
                      return [];
                  }
                  console.warn(`Rate Limit hit. Retrying in ${retryDelay}ms...`);
                  await delay(retryDelay);
                  retryDelay *= 1.5;
                  continue;
              }
              console.error("Fetch error:", error);
              return [];
          }
      }
  });
};

export const getSessions = async (year: number): Promise<Session[]> => {
  // CRITICAL: Force useCache = false.
  // This ensures that we always fetch the fresh list from the API.
  return fetchFromOpenF1('/sessions', { year }, false);
};

export const getDrivers = async (sessionKey: number): Promise<Driver[]> => {
  return fetchFromOpenF1('/drivers', { session_key: sessionKey });
};

export const getLaps = async (sessionKey: number, driverNumber?: number): Promise<Lap[]> => {
  const params: Record<string, string | number> = { session_key: sessionKey };
  if (driverNumber) params.driver_number = driverNumber;
  return fetchFromOpenF1('/laps', params);
};

export const getCarTelemetry = async (
  sessionKey: number, 
  driverNumber: number, 
  dateStart: string, 
  dateEnd: string
): Promise<CarData[]> => {
  const data = await fetchFromOpenF1('/car_data', {
      session_key: sessionKey,
      driver_number: driverNumber,
      'date>': dateStart, 
      'date<': dateEnd
  });

  // Ensure data is sorted (API usually does, but vital for interpolation)
  if(data.length > 0) {
      // Fast date comparison check first to avoid sorting already sorted arrays (common in API)
      let needsSort = false;
      for(let i = 0; i < data.length - 1; i++) {
          if (data[i].date > data[i+1].date) {
              needsSort = true;
              break;
          }
      }
      if (needsSort) {
          return data.sort((a: CarData, b: CarData) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
  }
  return data;
};

export const getLocationData = async (
  sessionKey: number, 
  driverNumber: number, 
  dateStart: string, 
  dateEnd: string
): Promise<LocationData[]> => {
  const data = await fetchFromOpenF1('/location', {
      session_key: sessionKey,
      driver_number: driverNumber,
      'date>': dateStart, 
      'date<': dateEnd
  });

  if(data.length > 0) {
      let needsSort = false;
      for(let i = 0; i < data.length - 1; i++) {
          if (data[i].date > data[i+1].date) {
              needsSort = true;
              break;
          }
      }
      if (needsSort) {
          return data.sort((a: LocationData, b: LocationData) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
  }
  return data;
};

export const getLatestSession = async (): Promise<Session | null> => {
    const now = new Date();
    const yearsToCheck = [now.getFullYear(), now.getFullYear() - 1];

    for (const year of yearsToCheck) {
        try {
            const sessions = await getSessions(year);
            // Filter and sort efficiently
            const startedSessions = [];
            for(const s of sessions) {
                if (new Date(s.date_start) < now) startedSessions.push(s);
            }
            
            if (startedSessions.length > 0) {
                // Return the last one (most recent)
                return startedSessions.reduce((prev, curr) => 
                    new Date(curr.date_start) > new Date(prev.date_start) ? curr : prev
                );
            }
        } catch (e) {
            console.error(`Error fetching sessions for ${year}`, e);
        }
    }
    return null;
}