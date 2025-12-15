const axios = require('axios')

async function testAuth () {
  try {
    const response = await axios.post(
      'https://api.ainative.studio/v1/public/auth/login-json',
      {
        username: 'admin@ainative.studio',
        password: 'Admin2025!Secure'
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    )
    console.log('SUCCESS:', response.data)
  } catch (error) {
    console.log('ERROR:', error.response?.data || error.message)
  }
}

testAuth()
