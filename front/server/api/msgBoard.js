const express = require('express')
const router = express.Router()
const db = require('../db/')
const getIp = require('../utils/getIp')
const api = require('../http/')
const confirmToken = require('../middleware/confirmToken')

// 获取留言列表
router.get('/api/front/messageBoard/gets', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10
  const skip = req.query.page * limit - limit
  const ip = getIp(req)
  try {
    const total = await db.msgBoard.count({ parentId: null })
    const doc = await db.msgBoard.aggregate([
      { $match: { parentId: null } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: db.msgBoard.collection.name,
          let: { pid: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$parentId', '$$pid'] } } }, { $sort: { _id: -1 } }],
          as: 'reply'
        }
      },
      { $sort: { _id: -1 } },
      { $set: { liked: 0 } }
    ])
    const ids = doc.map(item => item._id.toString())
    const existed = await db.commentIp.find({ ip, type: 0, like: 1, msgid: { $in: ids } })
    if (existed.length) {
      existed.forEach(item => {
        if (ids.includes(item.msgid.toString())) {
          doc.find(d => d._id.toString() === item.msgid.toString()).liked = 1
        }
      })
    }

    res.json({
      status: 200,
      data: doc,
      total,
      page: parseInt(req.query.page)
    })
  } catch (e) {
    res.status(500).end()
  }
})
// 赞 +1/-1
router.patch('/api/front/messageBoard/like', async (req, res) => {
  try {
    const ip = getIp(req)
    const existed = await db.commentIp.find({ ip, type: 0, msgid: req.body._id })
    // 点赞
    if (parseInt(req.body.inc) === 1) {
      // 此ip已经点赞过此条评论
      if (existed && existed.length && existed[0].like > 0) {
        res.json({
          status: 101,
          info: '您已经点过赞了 ~'
        })
      } else {
        // ip评论关联表存储
        await db
          .commentIp({
            type: 0,
            msgid: req.body._id,
            ip: getIp(req),
            like: 1
          })
          .save()
        // 更新留言表
        await db.msgBoard.update({ _id: req.body._id }, { $inc: { like: 1 } })
        res.json({
          status: 200,
          data: req.body._id,
          info: '点赞成功'
        })
      }
    }
    // 取消赞
    else if (parseInt(req.body.inc) === -1 && existed.length && existed[0].like === 1) {
      await db.msgBoard.update({ _id: req.body._id }, { $inc: { like: -1 } })
      res.json({
        status: 200,
        info: '已取消赞'
      })
    }
  } catch (e) {
    res.status(500).end()
  }
})

//后台留言板抓取
router.get('/api/getAdminBoard', confirmToken, (req, res) => {
  let limit = 10
  let skip = req.query.page * limit - limit

  db.msgBoard
    .find({}, (err, doc) => {
      if (err) {
        res.status(500).end()
      } else {
        res.json(doc)
      }
    })
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
})
// 留言存储
router.post('/api/front/messageBoard/save', async (req, res) => {
  try {
    const doc = await new db.msgBoard({
      ...req.body,
      like: 0
    }).save()
    res.json({
      status: 200,
      data: doc
    })
    if (process.env.NODEW_ENV === 'production') {
      const ipInfo = await api.get('https://ip.help.bj.cn', { ip: getIp(req) })
      console.log('返回ip信息===>>>>', ipInfo)
      if (ipInfo.status === '200' && ipInfo.data.length) {
        const info = ipInfo.data[0]
        await new db.news({
          type: 'msgboard',
          ip: info.ip,
          lng: info.adlng,
          lat: info.adlat,
          nation: info.nation,
          province: info.province,
          city: info.city,
          district: info.district,
          leaveMessageId: doc._id,
          content: doc.content,
          date: new Date()
        }).save()
      }
    }
  } catch (e) {
    res.status(500).end()
  }
})

//后台管理删除二级留言
router.patch('/api/reduceLeavewords', confirmToken, (req, res) => {
  db.msgBoard.update({ _id: req.body.mainId }, { $pull: { reply: { _id: req.body.secondId } } }, (err, doc) => {
    if (err) {
      res.status(500).end()
    } else {
      res.json({ deleteCode: 200 })
    }
  })
})
router.delete('/api/removeLeavewords', confirmToken, (req, res) => {
  //因为用到批量删除，所以删除项的_id均放到数组中
  db.msgBoard.remove({ _id: { $in: req.query.id } }, err => {
    if (err) {
      res.status(500).end()
    } else {
      res.json({ deleteCode: 200 })
    }
  })
})
module.exports = router
