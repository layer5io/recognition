import * as React from "react"

const NotFoundPage = ({ location }) => {
  return (
    <>
      <h1>404: Not Found</h1>
      <p>Please take a moment to let us know.</p>
    </>
  )
}

export const Head = () => <title>404: Not Found</title>

export default NotFoundPage