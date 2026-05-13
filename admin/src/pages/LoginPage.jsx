import { useState } from 'react'
import { postLogin, setSession } from '../api.js'
import { Button } from '../components/ui/button.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      const res = await postLogin({ email, password })
      setSession(res)
      window.location.href = '/'
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Ошибка')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-plantation bg-gradient-to-b from-timber to-aztec p-8 shadow-2xl shadow-black/40"
      >
        <div>
          <h1 className="font-mono text-sm font-bold uppercase tracking-widest text-turquoise">
            Basalt Admin
          </h1>
          <p className="mt-2 text-sm text-gull">
            Доступны учётные записи с ролью администратора или ментора.
          </p>
        </div>
        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        <div>
          <Label>Почта</Label>
          <Input
            className="mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <Label>Пароль</Label>
          <Input
            type="password"
            className="mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" variant="gradient" className="w-full">
          Войти
        </Button>
      </form>
    </div>
  )
}
