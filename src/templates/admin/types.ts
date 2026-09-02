export type Profile = {
  id: string
  username: string
  role: string
  status: string
  created_at: string
}

export type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; user: Profile }
  | { mode: 'view'; user: Profile }