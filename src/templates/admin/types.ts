export type Profile = {
  id: string
  username: string
  role: string
  status: string
  created_at: string
  email?: string | null
  cnic?: string | null
  bound_device_id?: string | null
  bound_device_name?: string | null
  bound_at?: string | null
  last_login_at?: string | null
  last_logout_at?: string | null
  last_location?: string | null
  last_coordinates?: string | null
  last_device_name?: string | null
  password_plain?: string | null
  password_changed_at?: string | null
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