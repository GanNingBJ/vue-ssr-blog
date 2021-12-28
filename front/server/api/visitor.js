const express = require('express')
const { Octokit } = require('@octokit/core')
const api = require('../http/server-api')
const router = express.Router()
const db = require('../db/')
const secret = require('../db/secret')

// 存储访客信息
router.post('/api/front/saveVisitor', async (req, res) => {
  if (req.body.type === '0') {
    const exist = await db.visitor.find({ name: req.body.name })
    if (exist.length) {
      res.json({ status: 100, info: '用户名已存在' })
      return
    }
  }
  new db.visitor(req.body).save((err, doc) => {
    if (err) {
      res.status(500).end()
    } else {
      res.json({ status: 200, data: doc })
    }
  })
})

//自定义用户名
router.get('/api/searchVisitor', (req, res) => {
  db.vistor.find({ name: req.query.name }, (err, doc) => {
    if (doc.length) {
      res.json({ status: 200, exist: 1 })
    } else {
      res.json({ status: 200, exist: 0 })
    }
  })
})

//github登录
router.get('/api/getGithub', (req, res) => {
  db.vistor.find({ githubID: req.query.id }, (err, doc) => {
    if (err) {
      res.status(500).end()
    } else {
      res.json(doc)
    }
  })
})
router.get('/login/git', (req, res) => {
  //请替换为自己的client_id
  let path = `https://github.com/login/oauth/authorize?client_id=${secret.github_client_id}&scope=['user']&redirect_uri=http://localhost:6180/login_github`
  res.redirect(path)
  res.status(200).end()
})
router.get('/login_github', (req, res) => {
  console.log('已经指向到login-github：：', req.query)
  const params = {
    client_id: secret.github_client_id,
    client_secret: secret.github_client_secret,
    code: req.query.code,
    scope: ['user'],
    redirect_uri: 'http://localhost:6180/login_github'
  }
  api
    .post('https://github.com/login/oauth/access_token', params)
    .then(fullData => {
      const arr1 = fullData.split('&')
      const arr2 = arr1[0].split('=')
      const token = arr2[1]
      console.log('获取到token====>>>>>', token)
      return token
    })
    .then(async token => {
      const octokit = new Octokit({ auth: `${token}` })
      const info = await octokit.request('GET /user')
      console.log('返回用户信息====>>>>', info.data)
      res.render('gc_back.html', { title: 'github登陆成功', userInfo: JSON.stringify(info.data) })
    })
    .catch(err => {
      res.status(500).end()
    })
})

module.exports = router
