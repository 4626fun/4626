These Base brand reference videos and the PDF were moved out of `frontend/public`
because they are not referenced by the app and were being uploaded with every
Vercel deployment.

If they need to become user-facing assets again, move only the required files
back into `frontend/public/base/`.
