import http from '@/http/'
export default {
  // 获取文章评论
  getArticleComments(payload) {
    return http.get('/api/front/comments/get', payload).then(data => {
      return data
    })
  },
  // 点赞留言
  likeArticleComment(payload) {
    return http.patch('/api/front/comments/like', payload).then(data => {
      return data
    })
  }
}
