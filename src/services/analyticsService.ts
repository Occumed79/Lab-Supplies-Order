const BASE_URL = import.meta.env.DEV ? '/api' : 'https://alex6oks0k.lastapp.dev'
const APP_ID = 'b78d6439-5723-4316-aa1a-1239face6db1'
const APP_VERSION = '1.0.0'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface UserAnalytics {
  uid?: string
  uuid: string
  launchnumber: number
  os: string
  osversion: string
  appversion: string
}

interface AnalyticsConfig {
  appId: string
  uid?: string
  appVersion?: string
}

class AnalyticsService {
  private isInitialized = false
  private config: AnalyticsConfig
  private cachedOS: string | null = null
  private cachedOSVersion: string | null = null

  constructor(config: AnalyticsConfig) {
    this.config = config
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      console.error('API request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  async initialize(appId?: string, uid?: string): Promise<void> {
    if (this.isInitialized && !appId && !uid) return
    try {
      if (appId) {
        this.config.appId = appId
      }
      if (uid) {
        this.config.uid = uid
        localStorage.setItem('analytics_uid', uid)
      }

      await this.logAppLaunch()
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize analytics:', error)
    }
  }

  async logAppLaunch(): Promise<void> {
    try {
      const result = await this.logAnalytics(
        this.config.uid,
        this.getStoredUuid(),
        this.getStoredLaunchNumber()
      )
      if (result.success) {
        console.log('App launch logged successfully')
      } else {
        console.warn('Failed to log app launch:', result.error)
      }
    } catch (error) {
      console.error('Error logging app launch:', error)
    }
  }

  async logAnalytics(
    uid?: string,
    uuid?: string,
    launchNumber?: number
  ): Promise<ApiResponse<any>> {
    const storedUuid = uuid || this.getStoredUuid()
    const storedLaunchNumber = launchNumber || this.getStoredLaunchNumber()
    
    const payload: {
      app_id: string
      uid?: string
      uuid: string
      launchnumber: number
      os: string
      osversion: string
      appversion: string
    } = {
      app_id: this.config.appId,
      uuid: storedUuid,
      launchnumber: storedLaunchNumber,
      os: this.getOperatingSystem(),
      osversion: this.getOSVersion(),
      appversion: this.config.appVersion || APP_VERSION
    }

    if (uid) {
      payload.uid = uid
    }

    return this.makeRequest('/analytics/log', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  updateUserId(uid: string): void {
    this.config.uid = uid
    localStorage.setItem('analytics_uid', uid)
  }

  getUserAnalytics(): UserAnalytics {
    return {
      uid: this.config.uid,
      uuid: this.getStoredUuid(),
      launchnumber: this.getStoredLaunchNumber(),
      os: this.getOperatingSystem(),
      osversion: this.getOSVersion(),
      appversion: this.config.appVersion || APP_VERSION
    }
  }

  getUserId(): string | null {
    return this.config.uid || localStorage.getItem('analytics_uid')
  }

  private getStoredUuid(): string {
    let uuid = localStorage.getItem('app_uuid')
    if (!uuid) {
      uuid = crypto.randomUUID()
      localStorage.setItem('app_uuid', uuid)
    }
    return uuid
  }

  private getStoredLaunchNumber(): number {
    const stored = localStorage.getItem('app_launch_number')
    if (!stored) {
      localStorage.setItem('app_launch_number', '1')
      return 1
    }
    const number = parseInt(stored, 10) + 1
    localStorage.setItem('app_launch_number', number.toString())
    return number
  }

  private getOperatingSystem(): string {
    if (this.cachedOS) return this.cachedOS
    
    const userAgent = navigator.userAgent
    if (userAgent.includes('Windows')) {
      this.cachedOS = 'Windows'
    } else if (userAgent.includes('Mac')) {
      this.cachedOS = 'macOS'
    } else if (userAgent.includes('Linux')) {
      this.cachedOS = 'Linux'
    } else if (userAgent.includes('Android')) {
      this.cachedOS = 'Android'
    } else if (userAgent.includes('iOS')) {
      this.cachedOS = 'iOS'
    } else {
      this.cachedOS = 'Unknown'
    }
    
    return 'Web'
  }

  private getOSVersion(): string {
    if (this.cachedOSVersion) return this.cachedOSVersion
    
    const userAgent = navigator.userAgent
    const match = userAgent.match(/(?:Windows NT|Mac OS X|Linux|Android|iPhone OS)\s*([\d._]+)/)
    this.cachedOSVersion = match ? match[1] : 'Unknown'
    
    return this.cachedOSVersion
  }
}

export const analyticsService = new AnalyticsService({
  appId: APP_ID,
  appVersion: APP_VERSION
})

export const createAnalyticsService = (config: AnalyticsConfig) => {
  return new AnalyticsService(config)
}

export type { UserAnalytics, AnalyticsConfig }