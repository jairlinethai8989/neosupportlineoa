export type StaffLocale = 'th' | 'en';

export const STAFF_LOCALE_STORAGE_KEY = 'neo_staff_locale_v1';

const messages = {
  th: {
    common: {
      language: 'ภาษา',
      thai: 'ไทย',
      english: 'English',
      switchLanguage: 'สลับภาษา',
      staffLanguageHint: 'ใช้กับหน้าพนักงานในระบบ',
    },
    sidebar: {
      sections: {
        operations: 'Operations',
        intelligence: 'Intelligence',
        system: 'System',
      },
      createTicket: 'สร้างใบงานใหม่',
      menu: {
        tickets: 'จัดการใบงาน',
        inbox: 'ห้องแชทลูกค้า',
        notifications: 'การแจ้งเตือน',
        dashboard: 'แดชบอร์ดและสถิติ',
        overview: 'ภาพรวมระบบ',
        performance: 'สถิติการทำงาน',
        reports: 'รายงานและ Broadcast',
        dailyReport: 'สรุปรายงานประจำวัน',
        reportHub: 'ศูนย์รวมรายงาน',
        customers: 'ฐานข้อมูลลูกค้า',
        settings: 'การตั้งค่า',
        profile: 'ข้อมูลส่วนตัว',
        notificationSettings: 'ตั้งค่าการแจ้งเตือน',
        branding: 'ข้อมูลองค์กร',
        staff: 'จัดการทีมงาน',
        sla: 'ตั้งค่า SLA',
        master: 'ข้อมูลพื้นฐาน',
        audit: 'บันทึกการใช้งาน',
      },
    },
    settingsNotifications: {
      title: 'ตั้งค่าการแจ้งเตือน',
      audioTitle: 'เสียงแจ้งเตือนใบงานใหม่',
      audioDescription: 'เปิดหรือปิดเสียง เลือกโหมดเสียง และเลือกไฟล์เสียงชายหรือหญิงได้ในหน้าเดียว',
      languageTitle: 'ภาษาที่ใช้ในระบบ',
      languageDescription: 'รอบแรกจะครอบคลุม Sidebar, Settings และ Tickets ของฝั่งพนักงาน',
      currentLanguage: 'ภาษาปัจจุบัน',
      soundEnabled: 'เปิดเสียงแจ้งเตือน',
      soundDisabled: 'ปิดเสียงแจ้งเตือน',
      soundBeep: 'เสียง Beep',
      soundBeepDescription: 'เสถียรที่สุดและเหมาะกับทุกเครื่อง',
      soundVoice: 'เสียงพูดจากไฟล์ MP3',
      soundVoiceDescription: 'เสถียรกว่า TTS ใน Chrome และเลือกเสียงผู้หญิงหรือผู้ชายได้',
      femaleVoice: 'เสียงผู้หญิง',
      femaleVoiceDescription: 'ใช้ไฟล์ new-ticket-female.mp3',
      maleVoice: 'เสียงผู้ชาย',
      maleVoiceDescription: 'ใช้ไฟล์ new-ticket-male.mp3',
      currentMode: 'โหมดปัจจุบัน',
      mutedMode: 'ปิดเสียงแจ้งเตือน',
      testSound: 'ทดสอบเสียง',
      systemNotificationTitle: 'Notification ของระบบ',
      systemNotificationDescription: 'ใช้สำหรับการเด้งแจ้งเตือนของระบบ เช่น มุมขวาล่าง และไม่จำเป็นสำหรับการเล่นเสียง',
      permissionStatus: 'สถานะสิทธิ์',
      unsupported: 'ไม่รองรับ',
      requestPermission: 'ขออนุญาต',
      noteTitle: 'หมายเหตุ',
      noteBody: 'ถ้าเลือกโหมดเสียงพูด ระบบจะเล่นไฟล์ MP3 ที่ฝังไว้แทน TTS เพื่อให้ Chrome, Edge และเบราว์เซอร์อื่นมีพฤติกรรมใกล้เคียงกันมากที่สุด',
    },
    tickets: {
      loadingWorkspace: 'กำลังรีเฟรช workspace...',
      workspaceTitle: 'ศูนย์จัดการใบงาน',
      filteredWorkspaceTitle: 'ผลลัพธ์ที่กรองแล้ว',
      clearFilter: 'ล้างตัวกรอง',
      workspaceDescription: 'ติดตามและจัดการใบงานแบบเรียลไทม์',
      filteredWorkspaceDescription: 'กำลังดูใบงานของลูกค้าเฉพาะราย',
      allTime: 'ทั้งหมด',
      today: 'วันนี้',
      last7Days: '7 วันล่าสุด',
      last31Days: '31 วันล่าสุด',
      customRange: 'เลือกช่วงเวลา',
      to: 'ถึง',
      debugError: 'ข้อผิดพลาด',
      list: 'รายการ',
      board: 'บอร์ด',
      searchPlaceholder: 'ค้นหาเลขใบงาน หัวข้อ หรือชื่อลูกค้า...',
      emptyColumn: 'ยังไม่มีใบงานในสถานะนี้',
      viewOnlyAccess: 'สิทธิ์แบบดูอย่างเดียว',
      claiming: 'กำลังรับงาน...',
      claimTicket: 'รับงาน',
      resolveTicket: 'ปิดงาน',
      openInboxChat: 'เปิดแชทใน inbox',
      openTicketDetails: 'เปิดรายละเอียดใบงาน',
      ticketId: 'เลขใบงาน',
      subject: 'หัวข้อ',
      hospital: 'โรงพยาบาล',
      customer: 'ลูกค้า',
      agent: 'เจ้าหน้าที่',
      status: 'สถานะ',
      actions: 'การทำงาน',
      noHospital: 'ไม่ระบุโรงพยาบาล',
      noData: '-',
      statuses: {
        new: 'ใบงานใหม่',
        inProgress: 'กำลังดำเนินงาน',
        resolved: 'ปิดแล้ว',
        escalated: 'ส่งต่อ',
        pending: 'รอดำเนินการ',
        assigned: 'มอบหมายแล้ว',
        closed: 'ปิดงาน',
      },
      priorities: {
        high: 'สูง',
        medium: 'กลาง',
        low: 'ต่ำ',
      },
    },
  },
  en: {
    common: {
      language: 'Language',
      thai: 'Thai',
      english: 'English',
      switchLanguage: 'Switch language',
      staffLanguageHint: 'Applies to the staff-facing app',
    },
    sidebar: {
      sections: {
        operations: 'Operations',
        intelligence: 'Intelligence',
        system: 'System',
      },
      createTicket: 'Create Ticket',
      menu: {
        tickets: 'Ticket Workspace',
        inbox: 'Customer Inbox',
        notifications: 'Notifications',
        dashboard: 'Dashboards & Analytics',
        overview: 'Overview',
        performance: 'Performance',
        reports: 'Reports & Broadcast',
        dailyReport: 'Daily Report',
        reportHub: 'Report Hub',
        customers: 'Customers',
        settings: 'Settings',
        profile: 'Profile',
        notificationSettings: 'Notification Settings',
        branding: 'Organization',
        staff: 'Staff',
        sla: 'SLA',
        master: 'Master Data',
        audit: 'Audit Log',
      },
    },
    settingsNotifications: {
      title: 'Notification Settings',
      audioTitle: 'New Ticket Alert Sound',
      audioDescription: 'Turn sound on or off, choose the alert mode, and select male or female voice clips in one place.',
      languageTitle: 'Interface Language',
      languageDescription: 'This first rollout covers the staff app sidebar, settings, and tickets pages.',
      currentLanguage: 'Current language',
      soundEnabled: 'Enable alert sound',
      soundDisabled: 'Disable alert sound',
      soundBeep: 'Beep sound',
      soundBeepDescription: 'Most stable and works well across devices.',
      soundVoice: 'Voice clip (MP3)',
      soundVoiceDescription: 'More reliable than browser TTS in Chrome and lets you choose female or male voice.',
      femaleVoice: 'Female voice',
      femaleVoiceDescription: 'Uses new-ticket-female.mp3',
      maleVoice: 'Male voice',
      maleVoiceDescription: 'Uses new-ticket-male.mp3',
      currentMode: 'Current mode',
      mutedMode: 'Alert sound is muted',
      testSound: 'Test sound',
      systemNotificationTitle: 'System notifications',
      systemNotificationDescription: 'Controls browser pop-up notifications, such as the lower-right toast, and is not required for playing sounds.',
      permissionStatus: 'Permission status',
      unsupported: 'Unsupported',
      requestPermission: 'Allow',
      noteTitle: 'Note',
      noteBody: 'Voice mode uses bundled MP3 files instead of browser TTS so Chrome, Edge, and other browsers behave more consistently.',
    },
    tickets: {
      loadingWorkspace: 'Refreshing workspace...',
      workspaceTitle: 'Ticket Workspace',
      filteredWorkspaceTitle: 'Filtered Workspace',
      clearFilter: 'Clear filter',
      workspaceDescription: 'Monitor and manage support tickets in real time',
      filteredWorkspaceDescription: 'Viewing tickets for a specific customer',
      allTime: 'All time',
      today: 'Today',
      last7Days: 'Last 7 days',
      last31Days: 'Last 31 days',
      customRange: 'Custom range',
      to: 'to',
      debugError: 'Error',
      list: 'List',
      board: 'Board',
      searchPlaceholder: 'Search ticket number, subject, or customer...',
      emptyColumn: 'No tickets in this status yet',
      viewOnlyAccess: 'View-only access',
      claiming: 'Claiming...',
      claimTicket: 'Claim ticket',
      resolveTicket: 'Resolve ticket',
      openInboxChat: 'Open inbox chat',
      openTicketDetails: 'Open ticket details',
      ticketId: 'Ticket ID',
      subject: 'Subject',
      hospital: 'Hospital',
      customer: 'Customer',
      agent: 'Agent',
      status: 'Status',
      actions: 'Actions',
      noHospital: 'Unspecified hospital',
      noData: '-',
      statuses: {
        new: 'New Ticket',
        inProgress: 'In Progress',
        resolved: 'Resolved',
        escalated: 'Escalated',
        pending: 'Pending',
        assigned: 'Assigned',
        closed: 'Closed',
      },
      priorities: {
        high: 'High',
        medium: 'Medium',
        low: 'Low',
      },
    },
  },
} as const;

type MessageTree = typeof messages.th;

function readMessage(tree: MessageTree, key: string): string | undefined {
  return key.split('.').reduce<unknown>((value, segment) => {
    if (value && typeof value === 'object' && segment in (value as Record<string, unknown>)) {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, tree) as string | undefined;
}

export function getStaffMessage(locale: StaffLocale, key: string): string {
  return readMessage(messages[locale], key) ?? readMessage(messages.th, key) ?? key;
}

export function translateTicketStatus(status: string, locale: StaffLocale): string {
  const normalized = String(status || 'new').trim().toLowerCase();
  const keyMap: Record<string, string> = {
    new: 'tickets.statuses.new',
    'in progress': 'tickets.statuses.inProgress',
    resolved: 'tickets.statuses.resolved',
    escalated: 'tickets.statuses.escalated',
    pending: 'tickets.statuses.pending',
    assigned: 'tickets.statuses.assigned',
    closed: 'tickets.statuses.closed',
  };

  return getStaffMessage(locale, keyMap[normalized] ?? 'tickets.statuses.new');
}

export function translateTicketPriority(priority: string, locale: StaffLocale): string {
  const normalized = String(priority || 'medium').trim().toLowerCase();
  const keyMap: Record<string, string> = {
    high: 'tickets.priorities.high',
    medium: 'tickets.priorities.medium',
    low: 'tickets.priorities.low',
  };

  return getStaffMessage(locale, keyMap[normalized] ?? 'tickets.priorities.medium');
}
