import { AuthError } from '@supabase/gotrue-js'
import { Factor } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { Button, Form, IconLock, Input } from 'ui'
import { object, string } from 'yup'

import AlertError from 'components/ui/AlertError'
import { GenericSkeletonLoader } from 'components/ui/ShimmeringLoader'
import { useMfaChallengeAndVerifyMutation } from 'data/profile/mfa-challenge-and-verify-mutation'
import { useMfaListFactorsQuery } from 'data/profile/mfa-list-factors-query'
import { useStore } from 'hooks'
import { usePushNext } from 'hooks/misc/useAutoAuthRedirect'
import { useSignOut } from 'lib/auth'

const signInSchema = object({
  code: string().required('MFA Code is required'),
})

const SignInMfaForm = () => {
  const { ui } = useStore()
  const pushNext = usePushNext()
  const queryClient = useQueryClient()
  const router = useRouter()
  const {
    data: factors,
    error: factorsError,
    isError: isErrorFactors,
    isSuccess: isSuccessFactors,
    isLoading: isLoadingFactors,
  } = useMfaListFactorsQuery()
  const {
    mutateAsync: mfaChallengeAndVerify,
    isLoading,
    isSuccess,
  } = useMfaChallengeAndVerifyMutation()
  const [selectedFactor, setSelectedFactor] = useState<Factor | null>(null)
  const signOut = useSignOut()

  const onClickLogout = async () => {
    await signOut()
    await router.replace('/sign-in')
  }

  useEffect(() => {
    if (isSuccessFactors) {
      // if the user wanders into this page and he has no MFA setup, send the user to the next screen
      if (factors.totp.length === 0) {
        queryClient.resetQueries().then(() => pushNext())
      }
      if (factors.totp.length > 0) {
        setSelectedFactor(factors.totp[0])
      }
    }
  }, [factors?.totp, isSuccessFactors, pushNext, queryClient])

  const onSignIn = async ({ code }: { code: string }) => {
    const toastId = ui.setNotification({
      category: 'loading',
      message: `Signing in...`,
    })
    if (selectedFactor) {
      await mfaChallengeAndVerify(
        { factorId: selectedFactor.id, code, refreshFactors: false },
        {
          onSuccess: async () => {
            ui.setNotification({
              id: toastId,
              category: 'success',
              message: `Signed in successfully!`,
            })

            await queryClient.resetQueries()

            await pushNext()
          },
          onError: (error) => {
            ui.setNotification({
              id: toastId,
              category: 'error',
              message: (error as AuthError).message,
            })
          },
        }
      )
    }
  }

  return (
    <>
      {isLoadingFactors && <GenericSkeletonLoader />}

      {isErrorFactors && <AlertError error={factorsError} subject="Failed to retrieve factors" />}

      {isSuccessFactors && (
        <Form
          validateOnBlur
          id="sign-in-mfa-form"
          initialValues={{ code: '' }}
          validationSchema={signInSchema}
          onSubmit={onSignIn}
        >
          {() => (
            <>
              <div className="flex flex-col gap-4">
                <Input
                  id="code"
                  name="code"
                  type="text"
                  autoFocus
                  icon={<IconLock />}
                  placeholder="XXXXXX"
                  disabled={isLoading}
                  autoComplete="off"
                  spellCheck="false"
                  autoCapitalize="none"
                  autoCorrect="off"
                  label={
                    selectedFactor && factors?.totp.length === 2
                      ? `Code generated by ${selectedFactor.friendly_name}`
                      : null
                  }
                />

                <div className="flex items-center justify-between space-x-2">
                  <Button
                    block
                    type="outline"
                    size="large"
                    disabled={isLoading || isSuccess}
                    onClick={onClickLogout}
                    className="opacity-80 hover:opacity-100 transition"
                  >
                    Cancel
                  </Button>
                  <Button
                    block
                    form="sign-in-mfa-form"
                    htmlType="submit"
                    size="large"
                    disabled={isLoading || isSuccess}
                    loading={isLoading || isSuccess}
                  >
                    {isLoading ? 'Verifying' : isSuccess ? 'Signing in' : 'Verify'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Form>
      )}

      <div className="my-8">
        <div className="text-sm">
          <span className="text-scale-1000">Unable to sign in?</span>{' '}
        </div>
        <ul className="list-disc pl-6">
          {factors?.totp.length === 2 && (
            <li>
              <a
                className="text-sm text-scale-1100 hover:text-scale-1200 cursor-pointer"
                onClick={() =>
                  setSelectedFactor(factors.totp.find((f) => f.id !== selectedFactor?.id)!)
                }
              >{`Authenticate using ${
                factors.totp.find((f) => f.id !== selectedFactor?.id)?.friendly_name
              }?`}</a>
            </li>
          )}
          <li>
            <Link
              passHref
              href="/support/new?subject=Unable+to+sign+in+via+MFA&category=Login_issues"
            >
              <a
                target="_blank"
                rel="noreferrer"
                className="text-sm transition text-scale-1100 hover:text-scale-1200"
              >
                Reach out to us via support
              </a>
            </Link>
          </li>
        </ul>
      </div>
    </>
  )
}

export default SignInMfaForm
