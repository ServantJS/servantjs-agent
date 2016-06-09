#include <node.h>
#include <uv.h>

#include "NetworkActivity.hpp"

namespace NetActivity {
    using v8::FunctionCallbackInfo;
    using v8::Isolate;
    using v8::Local;
    using v8::Object;
    using v8::String;
    using v8::Value;
    using v8::Array;
    using v8::Number;
    using v8::Handle;
    using v8::Function;
    using v8::Persistent;
    
    struct Work {
        uv_work_t  request;
        Persistent<Function> callback;
        
        char *error;
        int error_code;
        
        std::vector<NetworkInterface *> list;
    };
    
    static void WorkAsync(uv_work_t *req) {
        Work *work = static_cast<Work *>(req->data);
        
        if (load_interfaces(work->list)) {
            work->error_code = 1;
            work->error = strerror(errno);
        }
    }
    
    static void WorkAsyncComplete(uv_work_t *req,int status) {
        Isolate * isolate = Isolate::GetCurrent();
        v8::HandleScope handleScope(isolate); // Required for Node 4.x
        
        Work *work = static_cast<Work *>(req->data);
        Handle<Value> argv[2];
        
        if (work->error_code) {
            Local<Object> error = Object::New(isolate);
            error->Set(String::NewFromUtf8(isolate, "msg"), String::NewFromUtf8(isolate, work->error));
            error->Set(String::NewFromUtf8(isolate, "code"), Number::New(isolate, work->error_code));
            argv[0] = error;
            argv[1] = v8::Null(isolate);
        } else {
            Local<Array> nets = Array::New(isolate, (int)work->list.size());
            for (int i = 0; i < work->list.size(); i++) {
                NetworkInterface *ni = work->list[i];
                Local<Object> result = Object::New(isolate);
                Local<Object> packets = Object::New(isolate);
                Local<Object> bytes = Object::New(isolate);
                
                result->Set(String::NewFromUtf8(isolate, "index"), Number::New(isolate, ni->index));
                result->Set(String::NewFromUtf8(isolate, "name"), String::NewFromUtf8(isolate, ni->name));
                
                packets->Set(String::NewFromUtf8(isolate, "input"), Number::New(isolate, ni->ipackets));
                packets->Set(String::NewFromUtf8(isolate, "output"), Number::New(isolate, ni->opackets));
                
                bytes->Set(String::NewFromUtf8(isolate, "input"), Number::New(isolate, ni->ibytes));
                bytes->Set(String::NewFromUtf8(isolate, "output"), Number::New(isolate, ni->obytes));
                
                result->Set(String::NewFromUtf8(isolate, "packets"), packets);
                result->Set(String::NewFromUtf8(isolate, "bytes"), bytes);
                
                nets->Set(i, result);
                
                delete ni;
            }
            
            work->list.clear();
            
            argv[0] = v8::Null(isolate);
            argv[1] = nets;
        }
        
        Local<Function>::New(isolate, work->callback)->Call(isolate->GetCurrentContext()->Global(), 2, argv);
        work->callback.Reset();
        
        delete work;
    }
    
    void Method(const FunctionCallbackInfo<Value>& args) {
        Isolate* isolate = args.GetIsolate();
        
        Work * work = new Work();
        work->error_code = 0;
        work->request.data = work;
        
        Local<Function> callback = Local<Function>::Cast(args[0]);
        work->callback.Reset(isolate, callback);
        
        uv_queue_work(uv_default_loop(),&work->request,
                      WorkAsync,WorkAsyncComplete);
        
        args.GetReturnValue().Set(Undefined(isolate));
    }
    
    void init(Local<Object> exports) {
        NODE_SET_METHOD(exports, "get", Method);
    }
    
    NODE_MODULE(cpuaddon, init)
}