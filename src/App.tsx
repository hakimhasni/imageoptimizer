import { framer, CanvasNode } from "framer-plugin";
import { useState, useEffect } from "react";
import "./App.css";

framer.showUI({
    position: "top right",
    width: 1000,
    height: 700,
})

interface ImageInfo {
  id: string
  name: string
  src: string
  size: number
  isLocal: boolean
  isOptimized: boolean
  optimizedSrc?: string
  optimizedSize?: number
  node?: any
  thumbnail?: string
  applied?: boolean
}

interface OptimizationResult {
  originalSize: number
  optimizedSize: number
  optimizedBlob: Blob
  optimizedSrc: string
}

// Optimization constants
const BATCH_SIZE = 10;
const MAX_CONCURRENT_REQUESTS = 5;
const FREE_SCAN_LIMIT = 5;
const LEMONSQUEEZY_CHECKOUT_URL = "https://templatehaven.lemonsqueezy.com/buy/e4174560-68c2-4e04-9eb5-25408a67040e";
const LEMONSQUEEZY_MANAGE_URL = "https://templatehaven.lemonsqueezy.com/billing";

// Create a semaphore to limit concurrent network requests
class Semaphore {
  private max: number;
  private current: number;
  private queue: Array<() => void>;

  constructor(max: number) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.current < this.max) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }
  }
}

const networkSemaphore = new Semaphore(MAX_CONCURRENT_REQUESTS);

// Optimized image size fetching with caching
const imageSizeCache = new Map();

const getImageSizeOptimized = async (src: string): Promise<number> => {
  if (imageSizeCache.has(src)) {
    return imageSizeCache.get(src);
  }

  await networkSemaphore.acquire();
  
  try {
    // Use HEAD request first (faster than full download)
    const headResponse = await fetch(src, { method: 'HEAD' });
    if (headResponse.ok) {
      const contentLength = headResponse.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        imageSizeCache.set(src, size);
        return size;
      }
    }
    
    // Fallback to partial range request
    const rangeResponse = await fetch(src, {
      headers: { 'Range': 'bytes=0-1023' } // Just get first 1KB to check
    });
    
    if (rangeResponse.ok) {
      const contentRange = rangeResponse.headers.get('content-range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) {
          const size = parseInt(match[1], 10);
          imageSizeCache.set(src, size);
          return size;
        }
      }
    }
    
    // Final fallback - full download (only if others fail)
    const fullResponse = await fetch(src);
    const blob = await fullResponse.blob();
    const size = blob.size;
    imageSizeCache.set(src, size);
    return size;
    
  } catch (error) {
    console.warn('Failed to get image size for:', src, error);
    imageSizeCache.set(src, 0);
    return 0;
  } finally {
    networkSemaphore.release();
  }
};

// Optimized thumbnail creation
const createThumbnailOptimized = async (src: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Set a timeout to avoid hanging
    const timeout = setTimeout(() => {
      resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NEg0NEgyMFYyMFoiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+Cjwvc3ZnPgo=');
    }, 2000);
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        ctx?.drawImage(img, 0, 0, 64, 64);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Use JPEG for smaller thumbnails
      } catch (error) {
        resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NEg0NEgyMFYyMFoiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+Cjwvc3ZnPgo=');
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NEg0NEgyMFYyMFoiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+Cjwvc3ZnPgo=');
    };
    
    img.src = src;
  });
};

// License validation function
const validateLicenseKey = async (licenseKey: string): Promise<{ valid: boolean; status?: string }> => {
  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        license_key: licenseKey,
        instance_name: 'Image Optimizer Plugin'
      })
    });

    const data = await response.json();
    
    // Return validation result with status
    return {
      valid: data.valid === true,
      status: data.license_key?.status || 'unknown'
    };
  } catch (error) {
    console.error('License validation error:', error);
    return { valid: false, status: 'error' };
  }
};

// Reset license function for development
const resetLicenseToFree = async () => {
  const data = await getStorageData();
  data.isProUser = false;
  data.licenseKey = '';
  data.scanCount = 0; // Reset scan count to 0
  await setStorageData(data);
};

// Storage helpers - Updated to use user-specific storage
const getUserId = async (): Promise<string> => {
  // Use browser fingerprinting for user identification
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx!.textBaseline = 'top';
  ctx!.font = '14px Arial';
  ctx!.fillText('Framer Plugin User', 2, 2);
  const fingerprint = canvas.toDataURL();
  return btoa(fingerprint).substring(0, 16);
};

const getStorageData = async () => {
  try {
    const userId = await getUserId();
    const storageKey = `imageOptimizerData_${userId}`;
    
    // Try localStorage first for cross-project persistence
    const localData = localStorage.getItem(storageKey);
    if (localData) {
      const parsedData = JSON.parse(localData);
      // Migrate to new format if needed
      return {
        scanCount: parsedData.scanCount || 0,
        lastResetMonth: parsedData.lastResetMonth || new Date().getMonth(),
        isProUser: parsedData.isProUser || false,
        licenseKey: parsedData.licenseKey || '',
        userId: userId
      };
    }
    
    // Fallback to Framer storage for backwards compatibility
    const framerData = await framer.getPluginData('imageOptimizerData');
    if (framerData) {
      const parsedData = JSON.parse(framerData);
      const userData = {
        scanCount: parsedData.scanCount || 0,
        lastResetMonth: parsedData.lastResetMonth || new Date().getMonth(),
        isProUser: parsedData.isProUser || false,
        licenseKey: parsedData.licenseKey || '',
        userId: userId
      };
      
      // Migrate to localStorage
      localStorage.setItem(storageKey, JSON.stringify(userData));
      return userData;
    }
    
    // Default data for new users
    return {
      scanCount: 0,
      lastResetMonth: new Date().getMonth(),
      isProUser: false,
      licenseKey: '',
      userId: userId
    };
  } catch (error) {
    console.error('Error getting storage data:', error);
    const userId = await getUserId();
    return {
      scanCount: 0,
      lastResetMonth: new Date().getMonth(),
      isProUser: false,
      licenseKey: '',
      userId: userId
    };
  }
};

const setStorageData = async (data: any) => {
  try {
    const userId = data.userId || await getUserId();
    const storageKey = `imageOptimizerData_${userId}`;
    
    // Save to localStorage for cross-project persistence
    localStorage.setItem(storageKey, JSON.stringify(data));
    
    // Also save to Framer storage for backwards compatibility
    await framer.setPluginData('imageOptimizerData', JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save data:', error);
  }
};

export function App() {
  const [images, setImages] = useState<ImageInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [optimizing, setOptimizing] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'name' | 'size'>('size')
  const [activeTab, setActiveTab] = useState<'canvas' | 'cms'>('canvas')
  const [maxSize, setMaxSize] = useState<number>(1000000) // Default 1000KB to match design
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showWelcome, setShowWelcome] = useState(true)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showSubscriptionManage, setShowSubscriptionManage] = useState(false)
  const [showLicenseManage, setShowLicenseManage] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  
  // Freemium states
  const [scanCount, setScanCount] = useState(0)
  const [isProUser, setIsProUser] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')
  const [validatingLicense, setValidatingLicense] = useState(false)
  const [userId, setUserId] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize storage data on component mount
  useEffect(() => {
    const initializeData = async () => {
      const data = await getStorageData();
      
      // Reset scan count if it's a new month
      const currentMonth = new Date().getMonth();
      if (data.lastResetMonth !== currentMonth) {
        data.scanCount = 0;
        data.lastResetMonth = currentMonth;
        await setStorageData(data);
        
        // Show notification about monthly reset for free users
        if (!data.isProUser) {
          setTimeout(() => {
            framer.notify('Your monthly scan count has been reset to 0/5', { variant: 'info' });
          }, 1000);
        }
      }
      
      setScanCount(data.scanCount);
      setLicenseKey(data.licenseKey);
      setUserId(data.userId);
      
      // Auto-validate existing license key
      if (data.licenseKey && data.isProUser) {
        const validation = await validateLicenseKey(data.licenseKey);
        if (!validation.valid) {
          // License is invalid/expired, reset to free
          console.log('License validation failed, resetting to free mode');
          await resetLicenseToFree();
          setIsProUser(false);
          setLicenseKey('');
          framer.notify('License expired or invalid. Switched to Free mode.', { variant: 'error' });
        } else {
          setIsProUser(true);
        }
      } else {
        setIsProUser(data.isProUser);
      }
      
      // Mark as initialized to prevent UI flash
      setIsInitialized(true);
      
      // Show welcome message for new users
      if (data.scanCount === 0 && !data.isProUser && data.lastResetMonth === currentMonth) {
        setTimeout(() => {
          framer.notify(`Welcome! You have ${FREE_SCAN_LIMIT} free scans this month.`, { variant: 'info' });
        }, 2000);
      }
    };
    
    initializeData();
  }, []);

  // Check if user can scan
  const canScan = () => {
    return isProUser || scanCount < FREE_SCAN_LIMIT;
  };

  // Increment scan count
  const incrementScanCount = async () => {
    if (!isProUser) {
      const newCount = scanCount + 1;
      setScanCount(newCount);
      
      const data = await getStorageData();
      data.scanCount = newCount;
      await setStorageData(data);
      
      // Show warning when approaching limit
      if (newCount === FREE_SCAN_LIMIT - 1) {
        framer.notify('This is your last free scan for this month!', { variant: 'warning' });
      } else if (newCount >= FREE_SCAN_LIMIT) {
        framer.notify(`You've reached the ${FREE_SCAN_LIMIT} scan limit. Upgrade to PRO for unlimited scans!`, { variant: 'error' });
      } else {
        framer.notify(`Scan ${newCount}/${FREE_SCAN_LIMIT} used`, { variant: 'info' });
      }
    }
  };

  // Handle license key validation
  const handleLicenseValidation = async () => {
    if (!licenseKey.trim()) {
      framer.notify('Please enter a license key', { variant: 'error' });
      return;
    }

    setValidatingLicense(true);
    
    try {
      const validation = await validateLicenseKey(licenseKey.trim());
      
      if (validation.valid) {
        setIsProUser(true);
        const data = await getStorageData();
        data.isProUser = true;
        data.licenseKey = licenseKey.trim();
        await setStorageData(data);
        
        framer.notify('License validated! You now have PRO access.', { variant: 'success' });
        setShowLicenseManage(false); // Close the license management screen
      } else {
        // Reset to free mode on invalid license
        setIsProUser(false);
        const data = await getStorageData();
        data.isProUser = false;
        await setStorageData(data);
        
        const statusMessage = validation.status === 'expired' ? 'License has expired.' : 
                             validation.status === 'disabled' ? 'License has been disabled.' :
                             'Invalid license key.';
        
        framer.notify(`${statusMessage} Please check and try again.`, { variant: 'error' });
      }
    } catch (error) {
      framer.notify('Failed to validate license. Please try again.', { variant: 'error' });
    } finally {
      setValidatingLicense(false);
    }
  };

  // Development-only: Reset license to free mode
  const handleResetLicense = async () => {
    try {
      await resetLicenseToFree();
      setIsProUser(false);
      setLicenseKey('');
      setScanCount(0); // Reset scan count in local state too
      framer.notify('License reset to Free mode', { variant: 'success' });
    } catch (error) {
      framer.notify('Failed to reset license', { variant: 'error' });
    }
  };

  // Process items in batches
  const processBatch = async (items: any[], processor: (item: any) => Promise<any>, batchSize = BATCH_SIZE) => {
    const results: any[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(item => processor(item))
      );
      
      // Filter out rejected promises and extract values
      const successfulResults = batchResults
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
      
      results.push(...successfulResults);
      
      // Update progress - FIXED: Round the progress value
      const progress = Math.min(((i + batchSize) / items.length) * 100, 100);
      setScanProgress(Math.round(10 + (progress * 0.8))); // 10-90% for processing
    }
    
    return results;
  };

  // Optimized canvas image extraction
  const extractImageInfoFromBackgroundOptimized = async (node: any): Promise<ImageInfo | null> => {
    try {
      const backgroundImage = node.backgroundImage;
      if (!backgroundImage?.url) return null;

      const src = backgroundImage.url;
      const isLocal = !src.startsWith('http');
      
      // Check if this image was already optimized by checking the filename
      const isAlreadyOptimized = src.includes('optimized_') || 
                                backgroundImage.name?.includes('optimized_') ||
                                src.includes('.webp');
      
      // Process size and thumbnail in parallel
      const [size, thumbnail] = await Promise.allSettled([
        getImageSizeOptimized(src),
        createThumbnailOptimized(src)
      ]);
      
      const actualSize = size.status === 'fulfilled' ? size.value : 0;
      
      return {
        id: `canvas-${node.id}`,
        name: `Canvas: ${node.name || 'Background Image'}`,
        src,
        size: actualSize,
        isLocal,
        isOptimized: isAlreadyOptimized,
        node,
        thumbnail: thumbnail.status === 'fulfilled' ? thumbnail.value : undefined,
        applied: isAlreadyOptimized // Mark as applied if already optimized
      };
    } catch (error) {
      console.warn('Error extracting canvas image info:', error);
      return null;
    }
  };

  // Optimized CMS image extraction
  const extractImageInfoFromCMSOptimized = async (
    imageAsset: any, 
    collectionName: string, 
    itemId: string, 
    fieldName: string
  ): Promise<ImageInfo | null> => {
    try {
      if (!imageAsset?.url) return null;

      const src = imageAsset.url;
      const isLocal = !src.startsWith('http');
      
      // Process size and thumbnail in parallel
      const [size, thumbnail] = await Promise.allSettled([
        getImageSizeOptimized(src),
        createThumbnailOptimized(src)
      ]);
      
      return {
        id: `cms-${collectionName}-${itemId}-${fieldName}`,
        name: `CMS: ${collectionName} → ${fieldName}`,
        src,
        size: size.status === 'fulfilled' ? size.value : 0,
        isLocal,
        isOptimized: false,
        node: null,
        thumbnail: thumbnail.status === 'fulfilled' ? thumbnail.value : undefined
      };
    } catch (error) {
      console.warn('Error extracting CMS image info:', error);
      return null;
    }
  };

  // Main optimized fetch function
  const fetchProjectImages = async () => {
    // Check scan limit
    if (!canScan()) {
      framer.notify(`You've used all ${FREE_SCAN_LIMIT} scans this month across all projects. Please upgrade to PRO for unlimited scans.`, { variant: 'error' });
      return;
    }

    setLoading(true);
    setShowWelcome(false);
    setScanProgress(0);
    
    try {
      // Increment scan count
      await incrementScanCount();
      
      const imageInfos: ImageInfo[] = [];
      setScanProgress(Math.round(5));
      
      // Step 1: Get canvas images
      const nodesWithBackgroundImages = await framer.getNodesWithAttributeSet("backgroundImage");
      setScanProgress(Math.round(15));
      
      // Process canvas images in parallel batches
      if (nodesWithBackgroundImages.length > 0) {
        const canvasProcessor = (node: any) => {
          if (node && 'backgroundImage' in node && node.backgroundImage) {
            return extractImageInfoFromBackgroundOptimized(node);
          }
          return Promise.resolve(null);
        };
        
        const canvasImages = await processBatch(nodesWithBackgroundImages, canvasProcessor);
        imageInfos.push(...canvasImages);
      }
      
      setScanProgress(Math.round(50));
      
      // Step 2: Get CMS images
      try {
        const collections = await framer.getCollections();
        setScanProgress(Math.round(60));
        
        const cmsImageTasks: any[] = [];
        
        for (const collection of collections) {
          const [items, fields] = await Promise.all([
            collection.getItems(),
            collection.getFields()
          ]);
          
          const imageFields = fields.filter(field => field.type === 'image');
          
          for (const item of items) {
            for (const field of imageFields) {
              const imageData = item.fieldData[field.id];
              
              if (imageData && typeof imageData === 'object') {
                let imageUrl = imageData.url || 
                             imageData.value?.url || 
                             (typeof imageData.value === 'string' ? imageData.value : null);
                
                if (imageUrl) {
                  cmsImageTasks.push({
                    imageAsset: { url: imageUrl },
                    collectionName: collection.name,
                    itemId: item.slug || item.id,
                    fieldName: field.name
                  });
                }
              }
            }
          }
        }
        
        setScanProgress(Math.round(70));
        
        // Process CMS images in parallel batches
        if (cmsImageTasks.length > 0) {
          const cmsProcessor = (task: any) => extractImageInfoFromCMSOptimized(
            task.imageAsset, 
            task.collectionName, 
            task.itemId, 
            task.fieldName
          );
          
          const cmsImages = await processBatch(cmsImageTasks, cmsProcessor);
          imageInfos.push(...cmsImages);
        }
        
      } catch (cmsError) {
        console.log('CMS scanning failed:', cmsError);
      }
      
      setScanProgress(Math.round(90));
      
      // Remove duplicates
      const uniqueImages = imageInfos.filter((image, index, self) => 
        index === self.findIndex(img => img.src === image.src)
      );
      
      setImages(uniqueImages);
      setScanProgress(Math.round(100));
      
      // Notifications
      if (uniqueImages.length === 0) {
        framer.notify('No images found in project', { variant: 'info' });
      } else {
        const cmsCount = uniqueImages.filter(img => img.name.includes('CMS:')).length;
        const canvasCount = uniqueImages.length - cmsCount;
        framer.notify(`Found ${uniqueImages.length} image(s) (${canvasCount} canvas, ${cmsCount} CMS)`, { variant: 'success' });
      }
      
    } catch (error) {
      console.error('Error fetching images:', error);
      framer.notify('Error fetching project images', { variant: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setScanProgress(0), 1000);
    }
  };

  const convertToWebP = async (imageInfo: ImageInfo): Promise<OptimizationResult> => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(imageInfo.src)
        const blob = await response.blob()
        
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = async () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          // Start with original dimensions
          let currentWidth = img.width;
          let currentHeight = img.height;
          
          // Function to compress with given dimensions and quality
          const compressImage = (width: number, height: number, quality: number): Promise<Blob | null> => {
            return new Promise((resolve) => {
              const tempCanvas = document.createElement('canvas');
              const tempCtx = tempCanvas.getContext('2d');
              tempCanvas.width = width;
              tempCanvas.height = height;
              
              // Draw image with new dimensions
              tempCtx?.drawImage(img, 0, 0, width, height);
              
              tempCanvas.toBlob((blob) => {
                resolve(blob);
              }, 'image/webp', quality);
            });
          };

          // Target size in bytes (maxSize is already in bytes)
          const targetSize = maxSize;
          let bestResult: { blob: Blob; width: number; height: number; quality: number } | null = null;

          // Try different approaches to meet target size
          const approaches = [
            // Approach 1: High quality, original size
            { scale: 1.0, quality: 0.85 },
            { scale: 1.0, quality: 0.7 },
            { scale: 1.0, quality: 0.5 },
            { scale: 1.0, quality: 0.3 },
            
            // Approach 2: Moderate resize, good quality
            { scale: 0.8, quality: 0.85 },
            { scale: 0.8, quality: 0.7 },
            { scale: 0.8, quality: 0.5 },
            
            // Approach 3: More aggressive resize
            { scale: 0.6, quality: 0.85 },
            { scale: 0.6, quality: 0.7 },
            { scale: 0.6, quality: 0.5 },
            
            // Approach 4: Heavy resize but maintain some quality
            { scale: 0.4, quality: 0.85 },
            { scale: 0.4, quality: 0.7 },
            
            // Approach 5: Very aggressive (emergency)
            { scale: 0.3, quality: 0.7 },
            { scale: 0.2, quality: 0.8 },
          ];

          // Try each approach until we find one that meets the target
          for (const approach of approaches) {
            const testWidth = Math.floor(currentWidth * approach.scale);
            const testHeight = Math.floor(currentHeight * approach.scale);
            
            const testBlob = await compressImage(testWidth, testHeight, approach.quality);
            
            if (testBlob && testBlob.size <= targetSize) {
              bestResult = {
                blob: testBlob,
                width: testWidth,
                height: testHeight,
                quality: approach.quality
              };
              break; // Found a solution that meets target size
            }
            
            // Keep track of the best result so far (closest to target without going over)
            if (testBlob && (!bestResult || testBlob.size < bestResult.blob.size)) {
              bestResult = {
                blob: testBlob,
                width: testWidth,
                height: testHeight,
                quality: approach.quality
              };
            }
          }

          // If we still haven't met the target, do a final aggressive attempt
          if (!bestResult || bestResult.blob.size > targetSize) {
            console.log(`Image still too large (${bestResult?.blob.size || 'unknown'} bytes), trying final compression...`);
            
            // Very aggressive final attempt
            const finalWidth = Math.floor(currentWidth * 0.15);
            const finalHeight = Math.floor(currentHeight * 0.15);
            const finalBlob = await compressImage(finalWidth, finalHeight, 0.4);
            
            if (finalBlob) {
              bestResult = {
                blob: finalBlob,
                width: finalWidth,
                height: finalHeight,
                quality: 0.4
              };
            }
          }

          if (bestResult) {
            const optimizedSrc = URL.createObjectURL(bestResult.blob);
            
            console.log(`Compression result: ${imageInfo.size} → ${bestResult.blob.size} bytes (${Math.round((1 - bestResult.blob.size / imageInfo.size) * 100)}% reduction)`);
            console.log(`Dimensions: ${img.width}x${img.height} → ${bestResult.width}x${bestResult.height}`);
            console.log(`Quality: ${Math.round(bestResult.quality * 100)}%`);
            
            resolve({
              originalSize: imageInfo.size,
              optimizedSize: bestResult.blob.size,
              optimizedBlob: bestResult.blob,
              optimizedSrc
            });
          } else {
            reject(new Error('Failed to create optimized image'));
          }
        }
        img.onerror = reject
        img.src = URL.createObjectURL(blob)
      } catch (error) {
        reject(error)
      }
    })
  }

  const optimizeImage = async (imageInfo: ImageInfo) => {
    setOptimizing(prev => new Set(prev).add(imageInfo.id))
    
    try {
      const result = await convertToWebP(imageInfo)
      
      setImages(prev => prev.map(img => 
        img.id === imageInfo.id 
          ? {
              ...img,
              isOptimized: true,
              optimizedSrc: result.optimizedSrc,
              optimizedSize: result.optimizedSize
            }
          : img
      ))
      
      framer.notify(`Image optimized: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.optimizedSize)}`, { variant: 'success' })
    } catch (error) {
      console.error('Error optimizing image:', error)
      framer.notify('Error optimizing image', { variant: 'error' })
    } finally {
      setOptimizing(prev => {
        const newSet = new Set(prev)
        newSet.delete(imageInfo.id)
        return newSet
      })
    }
  }

  const optimizeAllImages = async () => {
    const unoptimizedImages = currentImages.filter(img => !img.isOptimized && img.size > maxSize)
    
    for (const imageInfo of unoptimizedImages) {
      await optimizeImage(imageInfo)
    }
  }

  const applyOptimizations = async () => {
    setLoading(true)
    
    try {
      const optimizedImages = images.filter(img => img.isOptimized && img.optimizedSrc && !img.applied)
      
      if (optimizedImages.length === 0) {
        framer.notify('No optimized images to apply', { variant: 'info' })
        return
      }
      
      let appliedCount = 0
      
      for (const imageInfo of optimizedImages) {
        if (imageInfo.node && imageInfo.optimizedSrc) {
          try {
            const optimizedFile = await fetch(imageInfo.optimizedSrc).then(r => r.blob())
            const originalName = imageInfo.name.replace(/^Canvas: /, '').replace(/\.[^/.]+$/, "")
            const fileName = `optimized_${originalName}_${Date.now()}.webp`
            const uploadedAsset = await framer.uploadImage(new File([optimizedFile], fileName, { type: 'image/webp' }))
            
            await framer.setAttributes(imageInfo.node.id, {
              backgroundImage: uploadedAsset
            })
            appliedCount++
            
            // Update the local state to reflect the change
            setImages(prev => prev.map(img => 
              img.id === imageInfo.id 
                ? { 
                    ...img, 
                    applied: true,
                    size: optimizedFile.size, // Update size to reflect new optimized size
                    src: URL.createObjectURL(optimizedFile) // Update src to optimized version
                  } 
                : img
            ))
            
          } catch (error) {
            console.error('Error applying canvas image:', error)
          }
        }
      }
      
      framer.notify(`Applied ${appliedCount} canvas image optimization(s)`, { variant: 'success' })
      
    } catch (error) {
      console.error('Error applying optimizations:', error)
      framer.notify('Error applying optimizations', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const downloadOptimizedImage = async (imageInfo: ImageInfo) => {
    if (!imageInfo.optimizedSrc) return
    
    try {
      const response = await fetch(imageInfo.optimizedSrc)
      const blob = await response.blob()
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `optimized_${imageInfo.name.replace(/^CMS: /, '').replace(/[^a-zA-Z0-9]/g, '_')}.webp`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      framer.notify('Optimized image downloaded', { variant: 'success' })
    } catch (error) {
      console.error('Error downloading image:', error)
      framer.notify('Error downloading image', { variant: 'error' })
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Filter and sort images
  const sortedImages = [...images].sort((a, b) => {
    if (sortBy === 'size') {
      return b.size - a.size
    }
    return a.name.localeCompare(b.name)
  })

  const canvasImages = sortedImages.filter(img => 
    img.id.startsWith('canvas-') && 
    (searchQuery === '' || img.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )
  const cmsImages = sortedImages.filter(img => 
    img.id.startsWith('cms-') && 
    (searchQuery === '' || img.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )
  const currentImages = activeTab === 'canvas' ? canvasImages : cmsImages

  // License Management Screen
  if (showLicenseManage) {
    return (
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f8f9fa',
        height: '100vh',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', height: '100vh', background: 'white' }}>
          <div style={{ flex: 1, padding: '20px 0px 20px 20px', overflow: 'auto' }}>
            <button
              onClick={() => setShowLicenseManage(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '30px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0',
                width: 'auto'
              }}
            >
              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.5312 18.9698C15.6009 19.0395 15.6562 19.1222 15.6939 19.2132C15.7316 19.3043 15.751 19.4019 15.751 19.5004C15.751 19.599 15.7316 19.6965 15.6939 19.7876C15.6562 19.8786 15.6009 19.9614 15.5312 20.031C15.4615 20.1007 15.3788 20.156 15.2878 20.1937C15.1967 20.2314 15.0991 20.2508 15.0006 20.2508C14.902 20.2508 14.8045 20.2314 14.7134 20.1937C14.6224 20.156 14.5396 20.1007 14.47 20.031L6.96996 12.531C6.90023 12.4614 6.84491 12.3787 6.80717 12.2876C6.76943 12.1966 6.75 12.099 6.75 12.0004C6.75 11.9019 6.76943 11.8043 6.80717 11.7132C6.84491 11.6222 6.90023 11.5394 6.96996 11.4698L14.47 3.96979C14.6107 3.82906 14.8016 3.75 15.0006 3.75C15.1996 3.75 15.3905 3.82906 15.5312 3.96979C15.6719 4.11052 15.751 4.30139 15.751 4.50042C15.751 4.69944 15.6719 4.89031 15.5312 5.03104L8.5609 12.0004L15.5312 18.9698Z" fill="currentColor"/>
              </svg>
              Back
            </button>

            <div style={{ marginBottom: '40px' }}>
              <div style={{
                display: 'inline-block',
                padding: '20px 24px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                fontSize: '16px',
                color: '#92400e',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>⚡</span>
                  You're on Free
                </div>
                <div style={{ fontSize: '14px', color: '#b45309' }}>
                  {scanCount} of {FREE_SCAN_LIMIT} scans used this month
                </div>
              </div>

              <div>
                <a 
                  href={LEMONSQUEEZY_CHECKOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Upgrade to PRO now
                </a>
              </div>
            </div>

            <div style={{ maxWidth: '400px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                Already have a license?
              </h3>
              
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px', lineHeight: '1.5' }}>
                Enter your license key below to unlock PRO features and unlimited scans.
              </p>
              
              <input
                type="text"
                placeholder="Enter your license key"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white',
                  color: '#374151',
                  outline: 'none',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
              />
              
              <button
                onClick={handleLicenseValidation}
                disabled={validatingLicense || !licenseKey.trim()}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 16px',
                  backgroundColor: validatingLicense || !licenseKey.trim() ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: validatingLicense || !licenseKey.trim() ? 'not-allowed' : 'pointer',
                  marginBottom: '12px'
                }}
              >
                {validatingLicense ? 'Validating license...' : 'Validate License'}
              </button>
              
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={handleResetLicense}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 16px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Reset License (Dev)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Subscription Management Screen
  if (showSubscriptionManage) {
    return (
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f8f9fa',
        height: '100vh',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', height: '100vh', background: 'white' }}>
          <div style={{ flex: 1, padding: '20px 0px 20px 20px', overflow: 'auto' }}>
            <button
              onClick={() => setShowSubscriptionManage(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '30px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0',
                width: 'auto'
              }}
            >
              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.5312 18.9698C15.6009 19.0395 15.6562 19.1222 15.6939 19.2132C15.7316 19.3043 15.751 19.4019 15.751 19.5004C15.751 19.599 15.7316 19.6965 15.6939 19.7876C15.6562 19.8786 15.6009 19.9614 15.5312 20.031C15.4615 20.1007 15.3788 20.156 15.2878 20.1937C15.1967 20.2314 15.0991 20.2508 15.0006 20.2508C14.902 20.2508 14.8045 20.2314 14.7134 20.1937C14.6224 20.156 14.5396 20.1007 14.47 20.031L6.96996 12.531C6.90023 12.4614 6.84491 12.3787 6.80717 12.2876C6.76943 12.1966 6.75 12.099 6.75 12.0004C6.75 11.9019 6.76943 11.8043 6.80717 11.7132C6.84491 11.6222 6.90023 11.5394 6.96996 11.4698L14.47 3.96979C14.6107 3.82906 14.8016 3.75 15.0006 3.75C15.1996 3.75 15.3905 3.82906 15.5312 3.96979C15.6719 4.11052 15.751 4.30139 15.751 4.50042C15.751 4.69944 15.6719 4.89031 15.5312 5.03104L8.5609 12.0004L15.5312 18.9698Z" fill="currentColor"/>
              </svg>
              Back
            </button>

            <div style={{ marginBottom: '40px' }}>
              <div style={{
                display: 'inline-block',
                padding: '20px 24px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #dcfce7',
                borderRadius: '12px',
                fontSize: '16px',
                color: '#166534',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>✅</span>
                  You're on PRO
                </div>
                <div style={{ fontSize: '14px', color: '#15803d' }}>
                  Unlimited scans
                </div>
              </div>

              <div>
                <a 
                  href={LEMONSQUEEZY_MANAGE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Manage subscription now
                </a>
              </div>
            </div>

            <div style={{ maxWidth: '400px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
                License Key
              </h3>
              
              <input
                type="text"
                placeholder="Enter your license key"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: '#f9fafb',
                  color: '#6b7280',
                  outline: 'none',
                  marginBottom: '16px',
                  boxSizing: 'border-box'
                }}
                disabled={true}
              />
              
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={handleResetLicense}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 16px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Reset License
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // How It Works Screen
  if (showHowItWorks) {
    return (
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f8f9fa',
        height: '100vh',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', height: '100vh', background: 'white' }}>
          <div style={{ flex: 1, padding: '20px 0px 20px 20px', overflow: 'auto' }}>
            <button
              onClick={() => setShowHowItWorks(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0',
                width: 'auto'
              }}
            >
              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.5312 18.9698C15.6009 19.0395 15.6562 19.1222 15.6939 19.2132C15.7316 19.3043 15.751 19.4019 15.751 19.5004C15.751 19.599 15.7316 19.6965 15.6939 19.7876C15.6562 19.8786 15.6009 19.9614 15.5312 20.031C15.4615 20.1007 15.3788 20.156 15.2878 20.1937C15.1967 20.2314 15.0991 20.2508 15.0006 20.2508C14.902 20.2508 14.8045 20.2314 14.7134 20.1937C14.6224 20.156 14.5396 20.1007 14.47 20.031L6.96996 12.531C6.90023 12.4614 6.84491 12.3787 6.80717 12.2876C6.76943 12.1966 6.75 12.099 6.75 12.0004C6.75 11.9019 6.76943 11.8043 6.80717 11.7132C6.84491 11.6222 6.90023 11.5394 6.96996 11.4698L14.47 3.96979C14.6107 3.82906 14.8016 3.75 15.0006 3.75C15.1996 3.75 15.3905 3.82906 15.5312 3.96979C15.6719 4.11052 15.751 4.30139 15.751 4.50042C15.751 4.69944 15.6719 4.89031 15.5312 5.03104L8.5609 12.0004L15.5312 18.9698Z" fill="currentColor"/>
              </svg>
              Back
            </button>

            <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 20px 0', color: '#111827' }}>
              How it works?
            </h2>

            <div style={{ lineHeight: '1.6', color: '#374151', maxWidth: '600px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 12px 0' }}>
                We scan your Framer project for all image assets
              </h3>
              
              <p style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
                We scan your Framer project for all image assets used on the canvas and in the CMS
              </p>
              
              <p style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
                Canvas images can be directly optimized and replaced inside your project with WebP versions.
              </p>

              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '20px 0 12px 0' }}>
                CMS Image Workflow:
              </h3>
              
              <p style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
                Due to Framer's CMS limitations, images used in CMS collections cannot be automatically replaced. After optimization, you can <strong>download the WebP files and manually re-upload them to your CMS collection</strong> to ensure content stays linked properly.
              </p>
              
              <p style={{ margin: '0', fontSize: '16px' }}>
                You can set your own max size limit (e.g. 500KB or 1000KB) to detect which images need optimization.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f8f9fa',
      height: '100vh',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', height: '100vh', background: 'white' }}>
        <div style={{
          width: '280px',
          minWidth: '280px',
          background: 'white',
          borderRight: '1px solid #e5e7eb',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
          height: '100vh'
        }}>
          {!isInitialized ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Loading...
            </div>
          ) : isProUser ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.00002 9.84375V3.75C6.00002 3.55109 5.92101 3.36032 5.78035 3.21967C5.6397 3.07902 5.44894 3 5.25002 3C5.05111 3 4.86035 3.07902 4.71969 3.21967C4.57904 3.36032 4.50002 3.55109 4.50002 3.75V9.84375C3.85471 10.009 3.28274 10.3843 2.87429 10.9105C2.46584 11.4367 2.24414 12.0839 2.24414 12.75C2.24414 13.4161 2.46584 14.0633 2.87429 14.5895C3.28274 15.1157 3.85471 15.491 4.50002 15.6562V20.25C4.50002 20.4489 4.57904 20.6397 4.71969 20.7803C4.86035 20.921 5.05111 21 5.25002 21C5.44894 21 5.6397 20.921 5.78035 20.7803C5.92101 20.6397 6.00002 20.4489 6.00002 20.25V15.6562C6.64533 15.491 7.2173 15.1157 7.62575 14.5895C8.0342 14.0633 8.25591 13.4161 8.25591 12.75C8.25591 12.0839 8.0342 11.4367 7.62575 10.9105C7.2173 10.3843 6.64533 10.009 6.00002 9.84375ZM5.25002 14.25C4.95335 14.25 4.66334 14.162 4.41667 13.9972C4.16999 13.8324 3.97774 13.5981 3.8642 13.324C3.75067 13.0499 3.72097 12.7483 3.77885 12.4574C3.83672 12.1664 3.97958 11.3367 4.18936 11.6893C4.39914 11.4796 4.66642 11.3367 4.95739 11.2788C5.24836 11.2209 5.54996 11.2506 5.82405 11.3642C6.09814 11.4777 6.33241 11.67 6.49723 11.9166C6.66205 12.1633 6.75002 12.4533 6.75002 12.75C6.75002 13.1478 6.59199 13.5294 6.31068 13.8107C6.02938 14.092 5.64785 14.25 5.25002 14.25ZM12.75 5.34375V3.75C12.75 3.55109 12.671 3.36032 12.5304 3.21967C12.3897 3.07902 12.1989 3 12 3C11.8011 3 11.6103 3.07902 11.4697 3.21967C11.329 3.36032 11.25 3.55109 11.25 3.75V5.34375C10.6047 5.50898 10.0327 5.88428 9.62429 6.41048C9.21584 6.93669 8.99414 7.58387 8.99414 8.25C8.99414 8.91613 9.21584 9.56331 9.62429 10.0895C10.0327 10.6157 10.6047 10.991 11.25 11.1562V20.25C11.25 20.4489 11.329 20.6397 11.4697 20.7803C11.6103 20.921 11.8011 21 12 21C12.1989 21 12.3897 20.921 12.5304 20.7803C12.671 20.6397 12.75 20.4489 12.75 20.25V11.1562C13.3953 10.991 13.9673 10.6157 14.3758 10.0895C14.7842 9.56331 15.0059 8.91613 15.0059 8.25C15.0059 7.58387 14.7842 6.93669 14.3758 6.41048C13.9673 5.88428 13.3953 5.50898 12.75 5.34375ZM12 9.75C11.7034 9.75 11.4133 9.66203 11.1667 9.4972C10.92 9.33238 10.7277 9.09811 10.6142 8.82402C10.5007 8.54994 10.471 8.24834 10.5288 7.95736C10.5867 7.66639 10.7296 7.39912 10.9394 7.18934C11.1491 6.97956 11.4164 6.8367 11.7074 6.77882C11.9984 6.72094 12.3 6.75065 12.574 6.86418C12.8481 6.97771 13.0824 7.16997 13.2472 7.41664C13.412 7.66332 13.5 7.95333 13.5 8.25C13.5 8.64782 13.342 9.02936 13.0607 9.31066C12.7794 9.59196 12.3978 9.75 12 9.75ZM21.75 15.75C21.7494 15.0849 21.5282 14.4388 21.121 13.9129C20.7139 13.387 20.1438 13.011 19.5 12.8438V3.75C19.5 3.55109 19.421 3.36032 19.2804 3.21967C19.1397 3.07902 18.9489 3 18.75 3C18.5511 3 18.3603 3.07902 18.2197 3.21967C18.079 3.36032 18 3.55109 18 3.75V12.8438C17.3547 13.009 16.7827 13.3843 16.3743 13.9105C15.9658 14.4367 15.7441 15.0839 15.7441 15.75C15.7441 16.4161 15.9658 17.0633 16.3743 17.5895C16.7827 18.1157 17.3547 18.491 18 18.6562V20.25C18 20.4489 18.079 20.6397 18.2197 20.7803C18.3603 20.921 18.5511 21 18.75 21C18.9489 21 19.1397 20.921 19.2804 20.7803C19.421 20.6397 19.5 20.4489 19.5 20.25V18.6562C20.1438 18.489 20.7139 18.113 21.121 17.5871C21.5282 17.0612 21.7494 16.4151 21.75 15.75ZM18.75 17.25C18.4534 17.25 18.1633 17.162 17.9167 16.9972C17.67 16.8324 17.4777 16.5981 17.3642 16.324C17.2507 16.0499 17.221 15.7483 17.2788 15.4574C17.3367 15.1664 17.4796 14.8991 17.6894 14.6893C17.8991 14.4796 18.1664 14.3367 18.4574 14.2788C18.7484 14.2209 19.05 14.2506 19.324 14.3642C19.5981 14.4777 19.8324 14.67 19.9972 14.9166C20.162 15.1633 20.25 15.4533 20.25 15.75C20.25 16.1478 20.092 16.5294 19.8107 16.8107C19.5294 17.092 19.1478 17.25 18.75 17.25Z" fill="currentColor"/>
              </svg>
              Settings
            </div>
          ) : (
            <div style={{
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              <div>You are on free</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                {scanCount} of {FREE_SCAN_LIMIT} scans used this month
              </div>
            </div>
          )}
          
          <div style={{ height: '1px', background: '#e5e7eb', margin: '8px -20px' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '2px' }}>
              Max image size (KB)
            </label>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px 0', lineHeight: '1.4' }}>
              Optimized images will be compressed to this target size.
            </p>
            <div style={{ position: 'relative' }}>
              <select 
                value={maxSize}
                onChange={(e) => setMaxSize(Number(e.target.value))}
                style={{
                  height: '40px',
                  padding: '0 36px 0 12px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  width: '100%',
                  appearance: 'none',
                  outline: 'none'
                }}
              >
                <option value={100000}>100 kb</option>
                <option value={200000}>200 kb</option>
                <option value={300000}>300 kb</option>
                <option value={500000}>500 kb</option>
                <option value={750000}>750 kb</option>
                <option value={1000000}>1000 kb</option>
              </select>
              <svg style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                width: '16px',
                height: '16px',
                color: '#6b7280'
              }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9" />
              </svg>
            </div>
          </div>

          <div style={{ height: '1px', background: '#e5e7eb', margin: '8px -20px' }}></div>

          {/* Subscription Section */}
          <div style={{ marginTop: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9L15.09 9.74L12 16L8.91 9.74L2 9L8.91 8.26L12 2Z" fill="currentColor"/>
              </svg>
              Subscription
            </div>

            {!isInitialized ? (
              // Show loading state to prevent UI flash
              <div style={{
                padding: '12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#6b7280'
              }}>
                Loading...
              </div>
            ) : isProUser ? (
              <div style={{
                padding: '12px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #dcfce7',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#166534'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', marginBottom: '4px' }}>
                  <span>✅</span>
                  You're on PRO
                </div>
                <div style={{ fontSize: '12px', color: '#15803d', marginBottom: '6px' }}>
                  Unlimited scans
                </div>
                <span
                  onClick={() => setShowSubscriptionManage(true)}
                  style={{
                    color: '#3b82f6',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Manage subscription
                </span>
              </div>
            ) : (
              <div style={{
                padding: '12px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                <div style={{ color: '#92400e', fontWeight: '500', marginBottom: '8px' }}>
                  You're on Free
                </div>
                <div style={{ fontSize: '12px', color: '#b45309', marginBottom: '8px' }}>
                  {scanCount} of {FREE_SCAN_LIMIT} scans used this month
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <a 
                    href={LEMONSQUEEZY_CHECKOUT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      padding: '6px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      textAlign: 'center',
                      fontWeight: '500'
                    }}
                  >
                    Upgrade to PRO
                  </a>
                  <span
                    onClick={() => setShowLicenseManage(true)}
                    style={{
                      color: '#6b7280',
                      fontSize: '11px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Already have a license?
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{
          flex: 1,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            padding: '0 4px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button
                onClick={fetchProjectImages}
                disabled={loading || !canScan()}
                style={{
                  background: loading || !canScan() ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  height: '40px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading || !canScan() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  maxWidth: '185px'
                }}
              >
                <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 4.50019V9.00019C21 9.1991 20.921 9.38987 20.7803 9.53052C20.6397 9.67117 20.4489 9.75019 20.25 9.75019H15.75C15.5511 9.75019 15.3603 9.67117 15.2197 9.53052C15.079 9.38987 15 9.1991 15 9.00019C15 8.80128 15.079 8.61051 15.2197 8.46986C15.3603 8.32921 15.5511 8.25019 15.75 8.25019H18.4397L17.0681 6.87863C15.6742 5.47838 13.7817 4.6884 11.8059 4.68207H11.7638C9.80454 4.67747 7.92227 5.44432 6.52406 6.81675C6.38083 6.95046 6.19096 7.02281 5.99507 7.01831C5.79918 7.01382 5.61283 6.93284 5.47588 6.79271C5.33893 6.65258 5.26226 6.46441 5.26227 6.26847C5.26228 6.07253 5.33897 5.88437 5.47594 5.74425C7.1705 4.08806 9.44983 3.16695 11.8193 3.18082C14.1887 3.19468 16.4571 4.14241 18.1322 5.81832L19.5 7.18988V4.50019C19.5 4.30128 19.579 4.11051 19.7197 3.96986C19.8603 3.82921 20.0511 3.75019 20.25 3.75019C20.4489 3.75019 20.6397 3.82921 20.7803 3.96986C20.921 4.11051 21 4.30128 21 4.50019ZM17.4759 17.1836C16.0639 18.5629 14.1651 19.3299 12.1912 19.3184C10.2173 19.3068 8.32762 18.5175 6.93188 17.1218L5.56031 15.7502H8.25C8.44891 15.7502 8.63968 15.6712 8.78033 15.5305C8.92098 15.3899 9 15.1991 9 15.0002C9 14.8013 8.92098 14.6105 8.78033 14.4699C8.63968 14.3292 8.44891 14.2502 8.25 14.2502H3.75C3.55109 14.2502 3.36032 14.3292 3.21967 14.4699C3.07902 14.6105 3 14.8013 3 15.0002V19.5002C3 19.6991 3.07902 19.8899 3.21967 20.0305C3.36032 20.1712 3.55109 20.2502 3.75 20.2502C3.94891 20.2502 4.13968 20.1712 4.28033 20.0305C4.42098 19.8899 4.5 19.6991 4.5 19.5002V16.8105L5.87156 18.1821C7.54426 19.8632 9.816 20.8114 12.1875 20.8183H12.2372C14.5885 20.8244 16.8476 19.9038 18.525 18.2561C18.662 18.116 18.7387 17.9279 18.7387 17.7319C18.7387 17.536 18.662 17.3478 18.5251 17.2077C18.3881 17.0675 18.2018 16.9866 18.0059 16.9821C17.81 16.9776 17.6201 17.0499 17.4769 17.1836H17.4759Z" fill="currentColor"/>
                </svg>
                {loading ? 'Scanning...' : 'Scan project'}
              </button>
              

            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: '160px' }}>
                <svg style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '16px',
                  height: '16px',
                  color: '#6b7280'
                }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input 
                  type="text"
                  placeholder="Search.."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    height: '40px',
                    padding: '0 12px 0 36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%',
                    background: 'white',
                    minWidth: '160px',
                    outline: 'none'
                  }}
                />
              </div>
              
              <div style={{ position: 'relative', minWidth: '140px' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'size')}
                  style={{
                    height: '40px',
                    padding: '0 36px 0 12px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    width: '100%',
                    appearance: 'none',
                    outline: 'none'
                  }}
                >
                  <option value="size">Sort by Size</option>
                  <option value="name">Sort by Name</option>
                </select>
                <svg style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  width: '16px',
                  height: '16px',
                  color: '#6b7280'
                }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6,9 12,15 18,9" />
                </svg>
              </div>
            </div>
          </div>

          <div style={{
            height: '1px',
            backgroundColor: '#e5e7eb',
            margin: '0 -24px 20px -24px',
          }} />

          <div style={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '8px',
            paddingBottom: '80px', // Add space for buttons
            position: 'relative'
          }} className="custom-scrollbar">
            <style jsx>{`
              .custom-scrollbar::-webkit-scrollbar {
                width: 8px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background-color: #d1d5db;
                border-radius: 4px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background-color: #9ca3af;
              }
              .custom-scrollbar {
                scrollbar-width: thin;
                scrollbar-color: #d1d5db transparent;
              }
            `}</style>
            {showWelcome && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                height: '100%',
                maxWidth: '500px',
                margin: '0 auto'
              }}>
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '16px'
                }}>
                  Welcome to Image Optimizer
                </h1>
                <p style={{
                  fontSize: '16px',
                  color: '#6b7280',
                  lineHeight: '1.5',
                  marginBottom: '32px'
                }}>
                  Speed up your Framer site by detecting and compressing large images directly inside your project.
                </p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '40px', justifyContent: 'center' }}>
                  <button
                    onClick={fetchProjectImages}
                    disabled={!canScan()}
                    style={{
                      display: 'inline-flex',
                      height: '40px',
                      padding: '0 16px',
                      minWidth: '120px',
                      maxWidth: '185px',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '8px',
                      background: !canScan() ? '#9ca3af' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: !canScan() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 4.50019V9.00019C21 9.1991 20.921 9.38987 20.7803 9.53052C20.6397 9.67117 20.4489 9.75019 20.25 9.75019H15.75C15.5511 9.75019 15.3603 9.67117 15.2197 9.53052C15.079 9.38987 15 9.1991 15 9.00019C15 8.80128 15.079 8.61051 15.2197 8.46986C15.3603 8.32921 15.5511 8.25019 15.75 8.25019H18.4397L17.0681 6.87863C15.6742 5.47838 13.7817 4.6884 11.8059 4.68207H11.7638C9.80454 4.67747 7.92227 5.44432 6.52406 6.81675C6.38083 6.95046 6.19096 7.02281 5.99507 7.01831C5.79918 7.01382 5.61283 6.93284 5.47588 6.79271C5.33893 6.65258 5.26226 6.46441 5.26227 6.26847C5.26228 6.07253 5.33897 5.88437 5.47594 5.74425C7.1705 4.08806 9.44983 3.16695 11.8193 3.18082C14.1887 3.19468 16.4571 4.14241 18.1322 5.81832L19.5 7.18988V4.50019C19.5 4.30128 19.579 4.11051 19.7197 3.96986C19.8603 3.82921 20.0511 3.75019 20.25 3.75019C20.4489 3.75019 20.6397 3.82921 20.7803 3.96986C20.921 4.11051 21 4.30128 21 4.50019ZM17.4759 17.1836C16.0639 18.5629 14.1651 19.3299 12.1912 19.3184C10.2173 19.3068 8.32762 18.5175 6.93188 17.1218L5.56031 15.7502H8.25C8.44891 15.7502 8.63968 15.6712 8.78033 15.5305C8.92098 15.3899 9 15.1991 9 15.0002C9 14.8013 8.92098 14.6105 8.78033 14.4699C8.63968 14.3292 8.44891 14.2502 8.25 14.2502H3.75C3.55109 14.2502 3.36032 14.3292 3.21967 14.4699C3.07902 14.6105 3 14.8013 3 15.0002V19.5002C3 19.6991 3.07902 19.8899 3.21967 20.0305C3.36032 20.1712 3.55109 20.2502 3.75 20.2502C3.94891 20.2502 4.13968 20.1712 4.28033 20.0305C4.42098 19.8899 4.5 19.6991 4.5 19.5002V16.8105L5.87156 18.1821C7.54426 19.8632 9.816 20.8114 12.1875 20.8183H12.2372C14.5885 20.8244 16.8476 19.9038 18.525 18.2561C18.662 18.116 18.7387 17.9279 18.7387 17.7319C18.7387 17.536 18.662 17.3478 18.5251 17.2077C18.3881 17.0675 18.2018 16.9866 18.0059 16.9821C17.81 16.9776 17.6201 17.0499 17.4769 17.1836H17.4759Z" fill="currentColor"/>
                    </svg>
                    Scan project
                  </button>
                  <button
                    onClick={() => setShowHowItWorks(true)}
                    style={{
                      display: 'inline-flex',
                      height: '40px',
                      padding: '0 16px',
                      minWidth: '120px',
                      maxWidth: '185px',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'white',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12.5 2.75C10.5716 2.75 8.68657 3.32183 7.08319 4.39317C5.47982 5.46452 4.23013 6.98726 3.49218 8.76884C2.75422 10.5504 2.56114 12.5108 2.93735 14.4021C3.31355 16.2934 4.24215 18.0307 5.60571 19.3943C6.96928 20.7579 8.70656 21.6865 10.5979 22.0627C12.4892 22.4389 14.4496 22.2458 16.2312 21.5078C18.0127 20.7699 19.5355 19.5202 20.6068 17.9168C21.6782 16.3134 22.25 14.4284 22.25 12.5C22.2473 9.91498 21.2192 7.43661 19.3913 5.60872C17.5634 3.78084 15.085 2.75273 12.5 2.75ZM12.5 20.75C10.8683 20.75 9.27326 20.2661 7.91655 19.3596C6.55984 18.4531 5.50242 17.1646 4.878 15.6571C4.25358 14.1496 4.0902 12.4908 4.40853 10.8905C4.72685 9.29016 5.51259 7.82015 6.66637 6.66637C7.82016 5.51259 9.29017 4.72685 10.8905 4.40852C12.4909 4.09019 14.1497 4.25357 15.6571 4.87799C17.1646 5.50242 18.4531 6.55984 19.3596 7.91655C20.2662 9.27325 20.75 10.8683 20.75 12.5C20.7475 14.6873 19.8775 16.7843 18.3309 18.3309C16.7843 19.8775 14.6873 20.7475 12.5 20.75ZM14 17C14 17.1989 13.921 17.3897 13.7803 17.5303C13.6397 17.671 13.4489 17.75 13.25 17.75C12.8522 17.75 12.4706 17.592 12.1893 17.3107C11.908 17.0294 11.75 16.6478 11.75 16.25V12.5C11.5511 12.5 11.3603 12.421 11.2197 12.2803C11.079 12.1397 11 11.9489 11 11.75C11 11.5511 11.079 11.3603 11.2197 11.2197C11.3603 11.079 11.5511 11 11.75 11C12.1478 11 12.5294 11.158 12.8107 11.4393C13.092 11.7206 13.25 12.1022 13.25 12.5V16.25C13.4489 16.25 13.6397 16.329 13.7803 16.4697C13.921 16.6103 14 16.8011 14 17ZM11 8.375C11 8.1525 11.066 7.93499 11.1896 7.74998C11.3132 7.56498 11.4889 7.42078 11.6945 7.33564C11.9001 7.25049 12.1263 7.22821 12.3445 7.27162C12.5627 7.31502 12.7632 7.42217 12.9205 7.5795C13.0778 7.73684 13.185 7.93729 13.2284 8.15552C13.2718 8.37375 13.2495 8.59995 13.1644 8.80552C13.0792 9.01109 12.935 9.18679 12.75 9.3104C12.565 9.43402 12.3475 9.5 12.125 9.5C11.8266 9.5 11.5405 9.38147 11.3295 9.1705C11.1185 8.95952 11 8.67337 11 8.375Z" fill="currentColor"/>
                    </svg>
                    How it works
                  </button>
                </div>
                
                {!canScan() && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#991b1b',
                    fontSize: '14px',
                    textAlign: 'center',
                    maxWidth: '400px'
                  }}>
                    You've used all {FREE_SCAN_LIMIT} scans this month across all projects. Please{' '}
                    <a 
                      href={LEMONSQUEEZY_CHECKOUT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: '500' }}
                    >
                      upgrade to PRO
                    </a>{' '}
                    for unlimited scans.
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <p style={{ fontSize: '18px', margin: '0 0 16px 0', fontWeight: '500' }}>
                  Scanning...
                </p>
                <div style={{
                  width: '100%',
                  maxWidth: '300px',
                  height: '6px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  margin: '0 auto'
                }}>
                  <div style={{
                    width: `${scanProgress}%`,
                    height: '100%',
                    backgroundColor: '#3b82f6',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <p style={{ fontSize: '14px', margin: '12px 0 0 0', fontWeight: '500' }}>
                  {Math.round(scanProgress)}%
                </p>
              </div>
            )}

            {!loading && !showWelcome && images.length > 0 && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '32px',
                  borderBottom: '1px solid #e5e7eb',
                  paddingBottom: '0px',
                  marginBottom: '20px',
                  paddingLeft: '4px'
                }}>
                  <div
                    onClick={() => setActiveTab('canvas')}
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: activeTab === 'canvas' ? '#3b82f6' : '#6b7280',
                      borderBottom: activeTab === 'canvas' ? '2px solid #3b82f6' : '2px solid transparent',
                      padding: '12px 0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Canvas ({canvasImages.length})
                  </div>
                  <div
                    onClick={() => setActiveTab('cms')}
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: activeTab === 'cms' ? '#3b82f6' : '#6b7280',
                      borderBottom: activeTab === 'cms' ? '2px solid #3b82f6' : '2px solid transparent',
                      padding: '12px 0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    CMS ({cmsImages.length})
                  </div>
                </div>

                {activeTab === 'cms' && (
                  <div style={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#495057',
                      lineHeight: '1.5'
                    }}>
                      <strong>CMS Image Workflow:</strong> Due to Framer's CMS architecture, optimized images cannot be automatically replaced in your collections. After optimization, download the WebP files and manually upload them through your CMS interface to maintain content integrity.
                    </div>
                  </div>
                )}

                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '16px',
                  paddingBottom: '20px'
                }}>
                  {currentImages.map((imageInfo) => (
                    <div
                      key={imageInfo.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: 'white',
                      }}
                    >
                      {imageInfo.thumbnail && (
                        <img
                          src={imageInfo.thumbnail}
                          alt="Thumbnail"
                          style={{
                            width: '100%',
                            height: '120px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            marginBottom: '12px',
                            border: '1px solid #e5e7eb'
                          }}
                        />
                      )}

                      <div>
                        <div style={{ 
                          fontWeight: '500', 
                          fontSize: '14px',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}>
                          <span style={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0,
                            color: '#374151'
                          }}>
                            {imageInfo.name.replace('Canvas: ', '').replace('CMS: ', '')}
                          </span>
                        </div>

                        <div style={{ 
                          fontSize: '13px',
                          color: '#6b7280',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ fontWeight: '500' }}>{formatFileSize(imageInfo.size)}</span>
                          {imageInfo.size > maxSize && !imageInfo.isOptimized && !imageInfo.applied && (
                            <span style={{ 
                              padding: '2px 6px',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '500'
                            }}>
                              ⚠️ Unoptimized
                            </span>
                          )}
                          {(imageInfo.isOptimized || imageInfo.applied) && (
                            <span style={{ 
                              padding: '2px 6px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '500'
                            }}>
                              ✓ Optimized
                            </span>
                          )}
                          {imageInfo.applied && (
                            <span style={{ 
                              padding: '2px 6px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '500'
                            }}>
                              📎 Applied
                            </span>
                          )}
                        </div>

                        {imageInfo.isOptimized && imageInfo.optimizedSize && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#10b981',
                            fontWeight: '500',
                            marginBottom: '12px',
                            padding: '6px 8px',
                            backgroundColor: '#f0fdf4',
                            borderRadius: '4px',
                            border: '1px solid #dcfce7'
                          }}>
                            Saved: {formatFileSize(imageInfo.size - imageInfo.optimizedSize)} 
                            ({Math.round((1 - imageInfo.optimizedSize / imageInfo.size) * 100)}%)
                          </div>
                        )}
                      </div>
                      
                      <div style={{ marginTop: '12px' }}>
                        {!imageInfo.isOptimized && !imageInfo.applied && imageInfo.size > maxSize && (
                          <button
                            onClick={() => optimizeImage(imageInfo)}
                            disabled={optimizing.has(imageInfo.id)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              backgroundColor: optimizing.has(imageInfo.id) ? '#9ca3af' : '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '500',
                              cursor: optimizing.has(imageInfo.id) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {optimizing.has(imageInfo.id) ? 'Converting...' : 'Convert to webp'}
                          </button>
                        )}
                        
                        {(imageInfo.isOptimized || imageInfo.applied) && imageInfo.size <= maxSize && (
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #dcfce7',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#15803d',
                            textAlign: 'center',
                            fontWeight: '500'
                          }}>
                            ✅ Already Optimized
                          </div>
                        )}
                        
                        {imageInfo.isOptimized && imageInfo.id.startsWith('cms-') && (
                          <button
                            onClick={() => downloadOptimizedImage(imageInfo)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            Download WebP
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!loading && !showWelcome && currentImages.length === 0 && images.length > 0 && (
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <p style={{ fontSize: '18px', margin: '0 0 8px 0', fontWeight: '500' }}>
                  No {activeTab} images found
                </p>
                <p style={{ fontSize: '14px', margin: '0' }}>
                  Switch to the other tab or scan your project again
                </p>
              </div>
            )}

            {!loading && !showWelcome && images.length === 0 && (
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <p style={{ fontSize: '18px', margin: '0 0 8px 0', fontWeight: '500' }}>
                  No images found
                </p>
                <p style={{ fontSize: '14px', margin: '0' }}>
                  Click "Scan Project" to analyze all images in your project
                </p>
              </div>
            )}
          </div>

          {/* Action buttons positioned at bottom of main content */}
          {!showWelcome && images.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '16px 24px',
              borderTop: '1px solid #EBEBEB',
              background: '#FFF',
              position: 'absolute',
              bottom: '0px',
              width: '100%',
              left: '0',
              gap: '8px'
            }}>
              <button
                onClick={optimizeAllImages}
                disabled={loading || currentImages.filter(img => !img.isOptimized && img.size > maxSize).length === 0}
                style={{
                  background: 'white',
                  color: '#3b82f6',
                  border: '1px solid #e5e7eb',
                  height: '40px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading || currentImages.filter(img => !img.isOptimized && img.size > maxSize).length === 0 ? 'not-allowed' : 'pointer',
                  opacity: loading || currentImages.filter(img => !img.isOptimized && img.size > maxSize).length === 0 ? 0.6 : 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  whiteSpace: 'nowrap'
                }}
              >
                Convert all to Webp
              </button>
              
              {activeTab === 'canvas' && (
                <button
                  onClick={applyOptimizations}
                  disabled={loading || canvasImages.filter(img => img.isOptimized && !img.applied).length === 0}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    height: '40px',
                    padding: '0 16px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: loading || canvasImages.filter(img => img.isOptimized && !img.applied).length === 0 ? 'not-allowed' : 'pointer',
                    opacity: loading || canvasImages.filter(img => img.isOptimized && !img.applied).length === 0 ? 0.6 : 1,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Apply to project
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
