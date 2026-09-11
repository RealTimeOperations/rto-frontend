export type Profile = {
  id: string
  username: string
  role: string
  status: string
  created_at: string
  cnic?: string | null
  can_attendance?: boolean
  can_vehicles?: boolean
  can_containers?: boolean
}

// Permission set for the currently logged-in user
export type Permissions = {
  attendance: boolean
  vehicles: boolean
  containers: boolean
}

export type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; user: Profile }
  | { mode: 'view'; user: Profile }